[CmdletBinding()]
param(
    [ValidatePattern('^[a-z0-9]{10}$')]
    [string]$NameSuffix = [guid]::NewGuid().ToString('N').Substring(0, 10),
    [ValidateSet('ea8de45a-97c7-4e6c-81f1-6cae597e83bb')]
    [string]$Subscription = 'ea8de45a-97c7-4e6c-81f1-6cae597e83bb'
)

$ErrorActionPreference = 'Stop'
$region = 'centralindia'
$resourceGroup = "rg-livequiz-ci-$NameSuffix"
$plan = "asp-livequiz-ci-$NameSuffix"
$app = 'solution-engineer-quiz'
# Sites created before the rename follow the old convention and may still sit in the group.
$legacyApp = "livequiz-ci-$NameSuffix"
$cosmos = "cosmoslivequiz$NameSuffix"
$cosmosDatabase = 'livequiz'
$cosmosContentContainer = 'quizContent'
$appInsights = "appi-livequiz-ci-$NameSuffix"
$communication = "acs-livequiz-$NameSuffix"
$emailService = "email-livequiz-$NameSuffix"
$emailDomain = 'AzureManagedDomain'
$communicationDataLocation = 'India'
$secondaryRegion = 'southindia'
$vnet = "vnet-livequiz-$NameSuffix"
$appSubnet = 'snet-app'
$privateEndpointSubnet = 'snet-pe'
$cosmosPrivateEndpoint = 'pe-cosmos-livequiz'
$cosmosPrivateDnsZone = 'privatelink.documents.azure.com'
$root = Split-Path -Parent $PSScriptRoot
$zipPath = Join-Path $PSScriptRoot ".live-quiz-deploy-$([guid]::NewGuid().ToString('N')).zip"
$stagePath = $null
$startupCommand = 'rm -rf /tmp/livequiz-deps && mkdir -p /tmp/livequiz-deps && tar -xzf /home/site/wwwroot/node_modules.tar.gz -C /tmp/livequiz-deps && cd /home/site/wwwroot && NODE_PATH=/tmp/livequiz-deps/node_modules node server.js'
$passphrase = $null
$adminPassphrase = $null
$token = $null
$communicationConnectionString = $null
$billablePossible = $false

function Invoke-Az {
    param([string[]]$CliArguments, [ValidateSet('json', 'tsv', 'none')][string]$Format = 'json')
    $arguments = @($CliArguments) + @('--subscription', $Subscription, '--only-show-errors', '--output', $Format)
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $result = & az @arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($exitCode -ne 0) {
        throw "Azure CLI '$($CliArguments[0..([Math]::Min(2, $CliArguments.Count - 1))] -join ' ')' failed in subscription $Subscription`: $($result -join ' ')"
    }
    if ($Format -ne 'none') { return ($result -join "`n").Trim() }
}

function Assert-ExpectedResources {
    $exists = Invoke-Az -CliArguments @('group', 'exists', '--name', $resourceGroup) -Format tsv
    if ($exists -eq 'false') { return $false }
    if ($exists -ne 'true') { throw "Could not establish whether resource group $resourceGroup exists." }
    $group = (Invoke-Az -CliArguments @('group', 'show', '--name', $resourceGroup) | ConvertFrom-Json)
    if ($group.location -ne $region) { throw "Resource group $resourceGroup is not in $region; refusing to reuse it." }
    $resources = @(Invoke-Az -CliArguments @('resource', 'list', '--resource-group', $resourceGroup) | ConvertFrom-Json)
    foreach ($resource in $resources) {
        $expectedPlan = $resource.type -ieq 'Microsoft.Web/serverfarms' -and $resource.name -ieq $plan
        $expectedApp = $resource.type -ieq 'Microsoft.Web/sites' -and
            ($resource.name -ieq $app -or $resource.name -ieq $legacyApp)
        $expectedCosmos = $resource.type -ieq 'Microsoft.DocumentDB/databaseAccounts' -and $resource.name -ieq $cosmos
        $expectedInsights = $resource.type -ieq 'Microsoft.Insights/components' -and $resource.name -ieq $appInsights
        $expectedCommunication = $resource.type -ieq 'Microsoft.Communication/communicationServices' -and $resource.name -ieq $communication
        $expectedEmail = $resource.type -ieq 'Microsoft.Communication/emailServices' -and $resource.name -ieq $emailService
        $expectedEmailDomain = $resource.type -ieq 'Microsoft.Communication/emailServices/domains' -and
            $resource.name -ieq "$emailService/$emailDomain"
        $expectedVnet = $resource.type -ieq 'Microsoft.Network/virtualNetworks' -and $resource.name -ieq $vnet
        $expectedPrivateEndpoint = $resource.type -ieq 'Microsoft.Network/privateEndpoints' -and $resource.name -ieq $cosmosPrivateEndpoint
        $expectedPrivateDns = $resource.type -ieq 'Microsoft.Network/privateDnsZones' -and $resource.name -ieq $cosmosPrivateDnsZone
        $expectedPrivateDnsLink = $resource.type -ieq 'Microsoft.Network/privateDnsZones/virtualNetworkLinks' -and
            $resource.name -ieq "$cosmosPrivateDnsZone/link-livequiz"
        # The private endpoint provisions its own NIC; it is owned by the endpoint, not declared directly.
        $expectedNic = $resource.type -ieq 'Microsoft.Network/networkInterfaces' -and $resource.name -ilike "$cosmosPrivateEndpoint.nic.*"
        $expected = $expectedPlan -or $expectedApp -or $expectedCosmos -or $expectedInsights -or
            $expectedCommunication -or $expectedEmail -or $expectedEmailDomain -or
            $expectedVnet -or $expectedPrivateEndpoint -or $expectedPrivateDns -or $expectedPrivateDnsLink -or $expectedNic
        # Private DNS and Communication Services email resources are global.
        $globalResource = $expectedPrivateDns -or $expectedPrivateDnsLink -or $expectedCommunication -or $expectedEmail -or $expectedEmailDomain
        $locationOk = $resource.location -eq $region -or ($globalResource -and $resource.location -ieq 'global')
        if (-not $expected -or -not $locationOk) {
            throw "Unexpected resource in $resourceGroup ($($resource.type)/$($resource.name)); refusing to reuse it."
        }
    }
    return $true
}

function Get-Resource {
    param([string]$Type, [string]$Name)
    $resources = @(Invoke-Az -CliArguments @('resource', 'list', '--resource-group', $resourceGroup) | ConvertFrom-Json)
    return @($resources | Where-Object { $_.type -ieq $Type -and $_.name -ieq $Name })
}

try {
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) { throw 'Azure CLI (az) is required.' }
    foreach ($file in @('server.js', 'admin-control-plane.js', 'questions.js', 'package.json', 'package-lock.json')) {
        $source = Join-Path $root $file
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
            throw "Missing deployable file: $file"
        }
        foreach ($directoryName in @('repositories', 'services')) {
            $directory = Join-Path $root $directoryName
            if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
                throw "Missing deployable directory: $directoryName"
            }
            if ((Get-Item -LiteralPath $directory).Attributes -band [IO.FileAttributes]::ReparsePoint -or
                @(Get-ChildItem -LiteralPath $directory -Directory -Recurse -Force |
                  Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count -gt 0) {
                throw "Refusing to package linked directory: $directoryName"
            }
        }
        if ((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Refusing to package linked file: $file"
        }
    }
    $public = Join-Path $root 'public'
    if (-not (Test-Path -LiteralPath $public -PathType Container)) { throw 'Missing public directory.' }
    if ((Get-Item -LiteralPath $public).Attributes -band [IO.FileAttributes]::ReparsePoint -or
        @(Get-ChildItem -LiteralPath $public -Directory -Recurse -Force |
          Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count -gt 0) {
        throw 'Refusing to package linked public directory.'
    }

    $allowLegacyPassphrase = [Environment]::GetEnvironmentVariable('ALLOW_LEGACY_HOST_PASSPHRASE', 'Process') -eq '1'
    $passphrase = [Environment]::GetEnvironmentVariable('HOST_PASSPHRASE', 'Process')
    $adminPassphrase = [Environment]::GetEnvironmentVariable('ADMIN_PASSPHRASE', 'Process')
    [Environment]::SetEnvironmentVariable('HOST_PASSPHRASE', $null, 'Process')
    [Environment]::SetEnvironmentVariable('ADMIN_PASSPHRASE', $null, 'Process')
    if ($allowLegacyPassphrase -and -not $passphrase) {
        $secure = Read-Host 'Host passphrase (minimum 16 characters)' -AsSecureString
        $buffer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { $passphrase = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($buffer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($buffer); $secure.Dispose() }
    }
    if (-not $allowLegacyPassphrase -and $passphrase) {
        throw 'HOST_PASSPHRASE was supplied without ALLOW_LEGACY_HOST_PASSPHRASE=1.'
    }
    if ($allowLegacyPassphrase -and ($passphrase.Length -lt 16 -or $passphrase.Length -gt 1024)) {
        throw 'Host passphrase must contain 16 to 1024 characters.'
    }
    if ($adminPassphrase) {
        $adminGroups = @('[a-z]', '[A-Z]', '\d', '[^a-zA-Z\d]') | Where-Object { $adminPassphrase -match $_ }
        if ($adminPassphrase.Length -lt 20 -or $adminPassphrase.Length -gt 1024 -or $adminGroups.Count -lt 3) {
            throw 'ADMIN_PASSPHRASE must contain 20 to 1024 characters and at least three character classes.'
        }
    }

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    # Install production dependencies locally so the zip is runnable as-is. The remote
    # Oryx build is disabled because npm install on the shared B1 instance overruns the
    # deployment timeout.
    $stagePath = Join-Path ([IO.Path]::GetTempPath()) "live-quiz-deps-$([guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $stagePath -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'package.json') -Destination $stagePath
    Copy-Item -LiteralPath (Join-Path $root 'package-lock.json') -Destination $stagePath
    Write-Host "Installing production dependencies in $stagePath ..."
    $npm = Get-Command npm -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $npm) { throw 'npm was not found on PATH; it is required to package dependencies.' }
    & $npm.Source 'ci' '--omit=dev' '--ignore-scripts' '--prefix' $stagePath
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE." }
    $stageModules = Join-Path $stagePath 'node_modules'
    if (-not (Test-Path -LiteralPath $stageModules -PathType Container)) { throw 'npm ci did not produce a node_modules directory.' }
    $nativeBinaries = @(Get-ChildItem -LiteralPath $stageModules -File -Recurse -Force -Filter '*.node' -ErrorAction SilentlyContinue)
    if ($nativeBinaries.Count -gt 0) {
        throw "Refusing to package Windows-native binaries: $($nativeBinaries[0].FullName)"
    }
    $tar = Get-Command tar -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $tar) { throw 'tar was not found on PATH; it is required to package dependencies.' }
    $dependencyArchive = Join-Path $stagePath 'node_modules.tar.gz'
    & $tar.Source '-czf' $dependencyArchive '-C' $stagePath 'node_modules'
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $dependencyArchive -PathType Leaf)) {
        throw "Creating the dependency archive failed with exit code $LASTEXITCODE."
    }

    $archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in @('server.js', 'admin-control-plane.js', 'questions.js', 'package.json', 'package-lock.json')) {
            [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $root $file), $file)
        }
        foreach ($directoryName in @('repositories', 'services')) {
            $directory = Join-Path $root $directoryName
            foreach ($file in @(Get-ChildItem -LiteralPath $directory -File -Recurse -Force)) {
                if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint -or $file.Extension -ne '.js') {
                    throw "Refusing to package unexpected server module: $($file.FullName)"
                }
                $relative = $file.FullName.Substring($root.Length).TrimStart('\') -replace '\\', '/'
                [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative)
            }
        }
        $files = @(Get-ChildItem -LiteralPath $public -File -Recurse -Force)
        if ($files.Count -eq 0) { throw 'The public directory has no assets.' }
        foreach ($file in $files) {
            $relative = $file.FullName.Substring($public.Length).TrimStart('\')
            $components = @($relative -split '\\')
            if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint -or
                @($components | Where-Object { $_.StartsWith('.') -or $_ -match '(?i)(secret|credential|password|passphrase|private)' }).Count -gt 0 -or
                $file.Extension -notin @('.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.gif', '.woff', '.woff2')) {
                throw "Refusing to package unexpected public asset: $relative"
            }
            $entryName = 'public/' + ($relative -replace '\\', '/')
            [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName)
        }
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $dependencyArchive,
            'node_modules.tar.gz',
            [System.IO.Compression.CompressionLevel]::NoCompression
        )
    } finally { $archive.Dispose() }

    $account = Invoke-Az -CliArguments @('account', 'show') | ConvertFrom-Json
    if ($account.id -ine $Subscription) { throw "Subscription $Subscription is unavailable to this Azure CLI login." }
    $groupExists = Assert-ExpectedResources
    foreach ($namespace in @('Microsoft.Web', 'Microsoft.DocumentDB', 'Microsoft.Insights', 'Microsoft.Communication')) {
        $provider = Invoke-Az -CliArguments @('provider', 'show', '--namespace', $namespace, '--query', 'registrationState') -Format tsv
        if ($provider -ne 'Registered') {
            Write-Host "Registering $namespace in subscription $Subscription (currently $provider)."
            try { Invoke-Az -CliArguments @('provider', 'register', '--namespace', $namespace, '--wait') -Format none }
            catch { throw "$namespace is not registered in subscription $Subscription. Registration failed: $_" }
            $provider = Invoke-Az -CliArguments @('provider', 'show', '--namespace', $namespace, '--query', 'registrationState') -Format tsv
            if ($provider -ne 'Registered') { throw "$namespace remains $provider; no hosting resources were created." }
        }
    }

    if (-not $groupExists) {
        Invoke-Az -CliArguments @('group', 'create', '--name', $resourceGroup, '--location', $region) -Format none
    }
    $plans = @(Get-Resource -Type 'Microsoft.Web/serverfarms' -Name $plan)
    if ($plans.Count -eq 0) {
        $billablePossible = $true
        Invoke-Az -CliArguments @('appservice', 'plan', 'create', '--resource-group', $resourceGroup, '--name', $plan,
            '--location', $region, '--sku', 'B1', '--is-linux', '--number-of-workers', '1') -Format none
    } else {
        $billablePossible = $true
        $currentPlan = Invoke-Az -CliArguments @('resource', 'show', '--ids', $plans[0].id,
            '--api-version', '2022-03-01', '--query', '{reserved:properties.reserved,sku:sku}') | ConvertFrom-Json
        if (-not $currentPlan.reserved -or
            $currentPlan.sku.tier -notin @('Basic', 'Standard', 'Premium', 'PremiumV2', 'PremiumV3', 'PremiumV4') -or
            $currentPlan.sku.capacity -ne 1) {
            throw "Existing plan $plan is not a one-worker dedicated Linux plan; refusing to change it."
        }
    }
    $planId = Invoke-Az -CliArguments @('appservice', 'plan', 'show', '--resource-group', $resourceGroup, '--name', $plan, '--query', 'id') -Format tsv
    $apps = @(Get-Resource -Type 'Microsoft.Web/sites' -Name $app)
    if ($apps.Count -eq 0) {
        # az rest does not infer a media type, and inline JSON is mangled by shell quoting,
        # so the body is sent from a file with an explicit Content-Type.
        $availabilityBody = Join-Path ([IO.Path]::GetTempPath()) "livequiz-cna-$([guid]::NewGuid().ToString('N')).json"
        try {
            Set-Content -LiteralPath $availabilityBody -Encoding ascii -NoNewline `
                -Value (@{ name = $app; type = 'Microsoft.Web/sites' } | ConvertTo-Json -Compress)
            $availability = Invoke-Az -CliArguments @('rest', '--method', 'post',
                '--url', "https://management.azure.com/subscriptions/$Subscription/providers/Microsoft.Web/checknameavailability?api-version=2022-03-01",
                '--headers', 'Content-Type=application/json',
                '--body', "@$availabilityBody") | ConvertFrom-Json
        } finally {
            Remove-Item -LiteralPath $availabilityBody -Force -ErrorAction SilentlyContinue
        }
        if (-not $availability.nameAvailable) {
            throw "The web app name '$app' is already taken globally, so https://$app.azurewebsites.net cannot be created. Reason: $($availability.reason). $($availability.message)"
        }
        Invoke-Az -CliArguments @('webapp', 'create', '--resource-group', $resourceGroup, '--plan', $plan, '--name', $app,
            '--runtime', 'NODE:24-lts') -Format none
    }
    $currentApp = Invoke-Az -CliArguments @('resource', 'show', '--ids', "/subscriptions/$Subscription/resourceGroups/$resourceGroup/providers/Microsoft.Web/sites/$app", '--api-version', '2022-03-01') | ConvertFrom-Json
    $currentPlanId = $currentApp.properties.serverFarmId
    $currentConfig = Invoke-Az -CliArguments @('webapp', 'config', 'show', '--resource-group', $resourceGroup, '--name', $app) | ConvertFrom-Json
    if ($currentPlanId -ine $planId -or $currentConfig.linuxFxVersion -ine 'NODE|24-lts') {
        throw "App $app is not on the expected Node 24 plan; refusing to continue."
    }
        $cosmosAccounts = @(Get-Resource -Type 'Microsoft.DocumentDB/databaseAccounts' -Name $cosmos)
        if ($cosmosAccounts.Count -eq 0) {
            Invoke-Az -CliArguments @('cosmosdb', 'create', '--resource-group', $resourceGroup, '--name', $cosmos,
                '--locations', "regionName=$region", 'failoverPriority=0', 'isZoneRedundant=False',
                '--locations', "regionName=$secondaryRegion", 'failoverPriority=1', 'isZoneRedundant=False',
                '--default-consistency-level', 'Strong', '--enable-automatic-failover', 'true',
                '--backup-policy-type', 'Continuous') -Format none
        }
        Invoke-Az -CliArguments @('cosmosdb', 'sql', 'database', 'create', '--resource-group', $resourceGroup,
            '--account-name', $cosmos, '--name', $cosmosDatabase, '--throughput', '400') -Format none
        Invoke-Az -CliArguments @('cosmosdb', 'sql', 'container', 'create', '--resource-group', $resourceGroup,
            '--account-name', $cosmos, '--database-name', $cosmosDatabase, '--name', $cosmosContentContainer,
            '--partition-key-path', '/batchId', '--ttl', '-1') -Format none
        Invoke-Az -CliArguments @('cosmosdb', 'sql', 'container', 'update', '--resource-group', $resourceGroup,
            '--account-name', $cosmos, '--database-name', $cosmosDatabase, '--name', $cosmosContentContainer,
            '--ttl', '-1') -Format none
        # Subscription policy force-disables public network access on Cosmos accounts, so the app
        # reaches Cosmos over a private endpoint via regional VNet integration.
        $vnets = @(Get-Resource -Type 'Microsoft.Network/virtualNetworks' -Name $vnet)
        if ($vnets.Count -eq 0) {
            Invoke-Az -CliArguments @('network', 'vnet', 'create', '--resource-group', $resourceGroup,
                '--name', $vnet, '--location', $region, '--address-prefixes', '10.20.0.0/16',
                '--subnet-name', $appSubnet, '--subnet-prefixes', '10.20.1.0/24') -Format none
            Invoke-Az -CliArguments @('network', 'vnet', 'subnet', 'create', '--resource-group', $resourceGroup,
                '--vnet-name', $vnet, '--name', $privateEndpointSubnet, '--address-prefixes', '10.20.2.0/24') -Format none
        }
        Invoke-Az -CliArguments @('network', 'vnet', 'subnet', 'update', '--resource-group', $resourceGroup,
            '--vnet-name', $vnet, '--name', $appSubnet, '--delegations', 'Microsoft.Web/serverFarms') -Format none
        Invoke-Az -CliArguments @('network', 'vnet', 'subnet', 'update', '--resource-group', $resourceGroup,
            '--vnet-name', $vnet, '--name', $privateEndpointSubnet,
            '--private-endpoint-network-policies', 'Disabled') -Format none

        $cosmosId = Invoke-Az -CliArguments @('cosmosdb', 'show', '--resource-group', $resourceGroup,
            '--name', $cosmos, '--query', 'id') -Format tsv
        $privateEndpoints = @(Get-Resource -Type 'Microsoft.Network/privateEndpoints' -Name $cosmosPrivateEndpoint)
        if ($privateEndpoints.Count -eq 0) {
            Invoke-Az -CliArguments @('network', 'private-endpoint', 'create', '--resource-group', $resourceGroup,
                '--name', $cosmosPrivateEndpoint, '--vnet-name', $vnet, '--subnet', $privateEndpointSubnet,
                '--private-connection-resource-id', $cosmosId, '--group-id', 'Sql',
                '--connection-name', 'cosmos-sql-conn') -Format none
        }
        $dnsZones = @(Get-Resource -Type 'Microsoft.Network/privateDnsZones' -Name $cosmosPrivateDnsZone)
        if ($dnsZones.Count -eq 0) {
            Invoke-Az -CliArguments @('network', 'private-dns', 'zone', 'create', '--resource-group', $resourceGroup,
                '--name', $cosmosPrivateDnsZone) -Format none
        }
        $dnsLink = Invoke-Az -CliArguments @('network', 'private-dns', 'link', 'vnet', 'list',
            '--resource-group', $resourceGroup, '--zone-name', $cosmosPrivateDnsZone,
            '--query', "[?name=='link-livequiz'].id | [0]") -Format tsv
        if (-not $dnsLink) {
            Invoke-Az -CliArguments @('network', 'private-dns', 'link', 'vnet', 'create',
                '--resource-group', $resourceGroup, '--name', 'link-livequiz',
                '--zone-name', $cosmosPrivateDnsZone, '--virtual-network', $vnet,
                '--registration-enabled', 'false') -Format none
        }
        $zoneGroup = Invoke-Az -CliArguments @('network', 'private-endpoint', 'dns-zone-group', 'list',
            '--resource-group', $resourceGroup, '--endpoint-name', $cosmosPrivateEndpoint,
            '--query', '[0].id') -Format tsv
        if (-not $zoneGroup) {
            Invoke-Az -CliArguments @('network', 'private-endpoint', 'dns-zone-group', 'create',
                '--resource-group', $resourceGroup, '--name', 'zg-cosmos',
                '--endpoint-name', $cosmosPrivateEndpoint, '--private-dns-zone', $cosmosPrivateDnsZone,
                '--zone-name', 'documents') -Format none
        }
        $vnetIntegration = Invoke-Az -CliArguments @('webapp', 'vnet-integration', 'list',
            '--resource-group', $resourceGroup, '--name', $app, '--query', '[0].id') -Format tsv
        if (-not $vnetIntegration) {
            Invoke-Az -CliArguments @('webapp', 'vnet-integration', 'add', '--resource-group', $resourceGroup,
                '--name', $app, '--vnet', $vnet, '--subnet', $appSubnet) -Format none
        }
        Invoke-Az -CliArguments @('webapp', 'config', 'set', '--resource-group', $resourceGroup,
            '--name', $app, '--vnet-route-all-enabled', 'true') -Format none

        $identity = Invoke-Az -CliArguments @('webapp', 'identity', 'assign', '--resource-group', $resourceGroup,
            '--name', $app) | ConvertFrom-Json
        $principalId = $identity.principalId
        if (-not $principalId) { throw "Managed identity was not assigned to $app." }
        $cosmosRole = Invoke-Az -CliArguments @('cosmosdb', 'sql', 'role', 'assignment', 'list',
            '--resource-group', $resourceGroup, '--account-name', $cosmos,
            '--query', "[?principalId=='$principalId' && roleDefinitionId!=null].id | [0]") -Format tsv
        if (-not $cosmosRole) {
            Invoke-Az -CliArguments @('cosmosdb', 'sql', 'role', 'assignment', 'create',
                '--resource-group', $resourceGroup, '--account-name', $cosmos, '--scope', '/',
                '--principal-id', $principalId,
                '--role-definition-id', '00000000-0000-0000-0000-000000000002') -Format none
        }
        $cosmosEndpoint = Invoke-Az -CliArguments @('cosmosdb', 'show', '--resource-group', $resourceGroup,
            '--name', $cosmos, '--query', 'documentEndpoint') -Format tsv
        $insightsResources = @(Get-Resource -Type 'Microsoft.Insights/components' -Name $appInsights)
        if ($insightsResources.Count -eq 0) {
            Invoke-Az -CliArguments @('monitor', 'app-insights', 'component', 'create', '--resource-group', $resourceGroup,
                '--app', $appInsights, '--location', $region, '--application-type', 'web') -Format none
        }
        $insightsConnectionString = Invoke-Az -CliArguments @('monitor', 'app-insights', 'component', 'show',
            '--resource-group', $resourceGroup, '--app', $appInsights, '--query', 'connectionString') -Format tsv

    Invoke-Az -CliArguments @('webapp', 'update', '--resource-group', $resourceGroup, '--name', $app, '--https-only', 'true') -Format none
    Invoke-Az -CliArguments @('webapp', 'config', 'set', '--resource-group', $resourceGroup, '--name', $app,
        '--always-on', 'true', '--startup-file', $startupCommand) -Format none
    $appId = Invoke-Az -CliArguments @('webapp', 'show', '--resource-group', $resourceGroup, '--name', $app, '--query', 'id') -Format tsv

    $communicationResources = @(Get-Resource -Type 'Microsoft.Communication/communicationServices' -Name $communication)
    if ($communicationResources.Count -eq 0) {
        Invoke-Az -CliArguments @('communication', 'create', '--resource-group', $resourceGroup,
            '--name', $communication, '--location', 'global',
            '--data-location', $communicationDataLocation) -Format none
    }
    $emailResources = @(Get-Resource -Type 'Microsoft.Communication/emailServices' -Name $emailService)
    if ($emailResources.Count -eq 0) {
        Invoke-Az -CliArguments @('communication', 'email', 'create', '--resource-group', $resourceGroup,
            '--name', $emailService, '--location', 'global',
            '--data-location', $communicationDataLocation) -Format none
    }
    $domainResources = @(Get-Resource -Type 'Microsoft.Communication/emailServices/domains' -Name "$emailService/$emailDomain")
    if ($domainResources.Count -eq 0) {
        Invoke-Az -CliArguments @('communication', 'email', 'domain', 'create',
            '--resource-group', $resourceGroup, '--email-service-name', $emailService,
            '--domain-name', $emailDomain, '--location', 'global',
            '--domain-management', 'AzureManaged') -Format none
    }
    $domain = $null
    $domainState = $null
    $fromSenderDomain = $null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $domain = Invoke-Az -CliArguments @('communication', 'email', 'domain', 'show',
            '--resource-group', $resourceGroup, '--email-service-name', $emailService,
            '--domain-name', $emailDomain) | ConvertFrom-Json
        $domainState = if ($domain.provisioningState) { $domain.provisioningState } else { $domain.properties.provisioningState }
        $fromSenderDomain = if ($domain.fromSenderDomain) { $domain.fromSenderDomain } else { $domain.properties.fromSenderDomain }
        if ($domainState -eq 'Succeeded' -and $fromSenderDomain) { break }
        if ($domainState -in @('Failed', 'Canceled')) { break }
        Start-Sleep -Seconds 10
    }
    if ($domainState -ne 'Succeeded' -or -not $fromSenderDomain) {
        throw "ACS Email domain is not ready (state '$domainState')."
    }

    $communicationResource = Invoke-Az -CliArguments @('communication', 'show',
        '--resource-group', $resourceGroup, '--name', $communication) | ConvertFrom-Json
    $communicationId = $communicationResource.id
    $communicationHostName = if ($communicationResource.hostName) { $communicationResource.hostName } else { $communicationResource.properties.hostName }
    $communicationEndpoint = "https://$communicationHostName"
    if (-not $communicationId -or $communicationEndpoint -notmatch '^https://[^/]+\.communication\.azure\.com$') {
        throw 'Could not determine the Azure Communication Services resource endpoint.'
    }
    $domainId = $domain.id
    $linkedDomainBody = @{ properties = @{ linkedDomains = @($domainId) } } | ConvertTo-Json -Depth 5 -Compress
    $managementToken = Invoke-Az -CliArguments @('account', 'get-access-token', '--resource', 'https://management.azure.com/', '--query', 'accessToken') -Format tsv
    try {
        [void](Invoke-RestMethod -Method Patch -Uri "https://management.azure.com$communicationId`?api-version=2023-03-31" -Headers @{ Authorization = "Bearer $managementToken" } -ContentType 'application/json' -Body $linkedDomainBody)
    } finally {
        $managementToken = $null
        $linkedDomainBody = $null
    }

    $roleAssignment = Invoke-Az -CliArguments @('role', 'assignment', 'list',
        '--assignee', $principalId, '--scope', $communicationId,
        '--query', "[?roleDefinitionName=='Contributor'].id | [0]") -Format tsv
    $emailAccessMode = 'managed-identity'
    if (-not $roleAssignment) {
        try {
            Invoke-Az -CliArguments @('role', 'assignment', 'create',
                '--assignee-object-id', $principalId, '--assignee-principal-type', 'ServicePrincipal',
                '--role', 'Contributor', '--scope', $communicationId) -Format none
        } catch {
            Write-Warning 'The deployment identity cannot create the ACS role assignment; using an ACS connection string stored only in App Service settings.'
            $communicationConnectionString = Invoke-Az -CliArguments @('communication', 'list-key',
                '--resource-group', $resourceGroup, '--name', $communication,
                '--query', 'primaryConnectionString') -Format tsv
            if (-not $communicationConnectionString) { throw 'Could not obtain an ACS connection string for email delivery.' }
            $emailAccessMode = 'connection-string'
        }
    }
    $emailSender = "donotreply@$fromSenderDomain"

    $healthConfigIssue = $null
    try {
        Invoke-Az -CliArguments @('resource', 'update', '--ids', "$appId/config/web",
            '--api-version', '2022-03-01', '--set', 'properties.healthCheckPath=/healthz') -Format none
        $configuredHealthPath = Invoke-Az -CliArguments @('resource', 'show', '--ids', "$appId/config/web",
            '--api-version', '2022-03-01', '--query', 'properties.healthCheckPath') -Format tsv
        if ($configuredHealthPath -ne '/healthz') {
            $healthConfigIssue = "Azure did not persist the path (read back '$configuredHealthPath')."
        }
    } catch {
        $healthConfigIssue = "Azure rejected the health-check configuration: $($_.Exception.Message)"
    }
    $url = "https://$app.azurewebsites.net"

    # ARM request bodies keep the optional emergency passphrase out of CLI arguments and local files.
    $token = Invoke-Az -CliArguments @('account', 'get-access-token', '--resource', 'https://management.azure.com/', '--query', 'accessToken') -Format tsv
    $headers = @{ Authorization = "Bearer $token" }
    $arm = "https://management.azure.com/subscriptions/$Subscription/resourceGroups/$resourceGroup/providers/Microsoft.Web/sites/$app/config/appsettings"
    try {
        $existingSettings = Invoke-RestMethod -Method Post -Uri "$arm/list?api-version=2022-03-01" -Headers $headers
        $settings = @{}
        if ($existingSettings.properties) {
            foreach ($property in $existingSettings.properties.PSObject.Properties) {
                $settings[$property.Name] = $property.Value
            }
        }
        # Dependencies are installed locally and shipped inside the zip, so the Oryx
        # remote build is disabled. Building on the shared B1 instance exceeded the
        # deployment timeout.
        $settings['SCM_DO_BUILD_DURING_DEPLOYMENT'] = 'false'
        $settings['ENABLE_ORYX_BUILD'] = 'false'
        $settings['PUBLIC_BASE_URL'] = $url
        $settings['NODE_ENV'] = 'production'
        # Required so the app resolves the Cosmos private endpoint through Azure DNS.
        $settings['WEBSITE_DNS_SERVER'] = '168.63.129.16'
        $settings['WEBSITE_VNET_ROUTE_ALL'] = '1'
        $settings['HOST_EMAIL_MODE'] = 'acs'
        $settings['HOST_EMAIL_ENDPOINT'] = $communicationEndpoint
        if ($emailAccessMode -eq 'connection-string') { $settings['HOST_EMAIL_CONNECTION_STRING'] = $communicationConnectionString }
        else { $settings.Remove('HOST_EMAIL_CONNECTION_STRING') }
        $settings['HOST_EMAIL_SENDER'] = $emailSender
        $settings['HOST_ALLOWED_EMAIL_DOMAINS'] = 'github.com,microsoft.com'
        $settings['HOST_OTP_TTL_SECONDS'] = '600'
        $settings['HOST_OTP_MAX_ATTEMPTS'] = '5'
        $settings['HOST_OTP_RESEND_SECONDS'] = '60'
        $settings['HOST_OTP_RATE_WINDOW_SECONDS'] = '3600'
        $settings['HOST_OTP_EMAIL_REQUEST_LIMIT'] = '5'
        $settings['HOST_OTP_IP_REQUEST_LIMIT'] = '20'
        if ($adminPassphrase) { $settings['ADMIN_PASSPHRASE'] = $adminPassphrase }
        elseif (-not $settings.ContainsKey('ADMIN_PASSPHRASE')) {
            throw 'ADMIN_PASSPHRASE must be supplied for the first admin-dashboard deployment.'
        }
        $settings['ADMIN_SESSION_TTL_SECONDS'] = '28800'
        $settings['ADMIN_LOGIN_RATE_WINDOW_SECONDS'] = '900'
        $settings['ADMIN_LOGIN_ATTEMPT_LIMIT'] = '5'
        $settings['ADMIN_HOST_CODE_TTL_SECONDS'] = '600'
        $settings['ADMIN_HOST_CODE_MAX_ATTEMPTS'] = '5'
        $settings['ADMIN_AUDIT_RETENTION_DAYS'] = '90'
        $settings['ALLOW_LEGACY_HOST_PASSPHRASE'] = if ($allowLegacyPassphrase) { '1' } else { '0' }
        if ($allowLegacyPassphrase) { $settings['HOST_PASSPHRASE'] = $passphrase }
        else { $settings.Remove('HOST_PASSPHRASE') }
        $settings['COSMOS_ENDPOINT'] = $cosmosEndpoint
        $settings['COSMOS_DATABASE'] = $cosmosDatabase
        $settings['COSMOS_CONTENT_CONTAINER'] = $cosmosContentContainer
        foreach ($obsoleteSetting in @(
            'COSMOS_GENERATION_CONTAINER',
            'AI_GENERATION_ENABLED',
            'AI_GENERATION_TIMEOUT_MS',
            'AZURE_OPENAI_ENDPOINT',
            'AZURE_OPENAI_DEPLOYMENT',
            'AZURE_OPENAI_API_VERSION',
            'AZURE_OPENAI_API_KEY',
            'AZURE_OPENAI_PRIMARY_ENDPOINT',
            'AZURE_OPENAI_PRIMARY_DEPLOYMENT',
            'AZURE_OPENAI_PRIMARY_MODEL',
            'AZURE_OPENAI_PRIMARY_API_VERSION',
            'AZURE_OPENAI_SECONDARY_ENDPOINT',
            'AZURE_OPENAI_SECONDARY_DEPLOYMENT',
            'AZURE_OPENAI_SECONDARY_MODEL',
            'AZURE_OPENAI_SECONDARY_API_VERSION'
        )) {
            $settings.Remove($obsoleteSetting)
        }
        $settings['APPLICATIONINSIGHTS_CONNECTION_STRING'] = $insightsConnectionString
        $body = @{ properties = $settings } | ConvertTo-Json -Depth 5 -Compress
        [void](Invoke-RestMethod -Method Put -Uri "$arm`?api-version=2022-03-01" -Headers $headers -ContentType 'application/json' -Body $body)
    } catch {
        throw "Could not configure application settings in subscription $Subscription (ARM status $([int]$_.Exception.Response.StatusCode)). Check web app configuration permissions."
    } finally {
        $body = $null
        $settings = $null
        $headers = $null
        $token = $null
        $passphrase = $null
        $adminPassphrase = $null
    }

    $configuredSettings = @(Invoke-Az -CliArguments @('webapp', 'config', 'appsettings', 'list',
        '--resource-group', $resourceGroup, '--name', $app) | ConvertFrom-Json)
    $configuredByName = @{}
    foreach ($setting in $configuredSettings) { $configuredByName[$setting.name] = $setting.value }
    $expectedAuthSettings = @{
        HOST_EMAIL_MODE = 'acs'
        HOST_EMAIL_ENDPOINT = $communicationEndpoint
        HOST_EMAIL_SENDER = $emailSender
        HOST_ALLOWED_EMAIL_DOMAINS = 'github.com,microsoft.com'
        HOST_OTP_TTL_SECONDS = '600'
        HOST_OTP_MAX_ATTEMPTS = '5'
        HOST_OTP_RESEND_SECONDS = '60'
        HOST_OTP_RATE_WINDOW_SECONDS = '3600'
        HOST_OTP_EMAIL_REQUEST_LIMIT = '5'
        HOST_OTP_IP_REQUEST_LIMIT = '20'
        ADMIN_SESSION_TTL_SECONDS = '28800'
        ADMIN_LOGIN_RATE_WINDOW_SECONDS = '900'
        ADMIN_LOGIN_ATTEMPT_LIMIT = '5'
        ADMIN_HOST_CODE_TTL_SECONDS = '600'
        ADMIN_HOST_CODE_MAX_ATTEMPTS = '5'
        ADMIN_AUDIT_RETENTION_DAYS = '90'
        ALLOW_LEGACY_HOST_PASSPHRASE = if ($allowLegacyPassphrase) { '1' } else { '0' }
    }
    foreach ($obsoleteAiSetting in @(
        'AI_GENERATION_ENABLED',
        'AI_GENERATION_TIMEOUT_MS',
        'AZURE_OPENAI_ENDPOINT',
        'AZURE_OPENAI_DEPLOYMENT',
        'AZURE_OPENAI_API_VERSION',
        'AZURE_OPENAI_API_KEY'
    )) {
        if ($configuredByName.ContainsKey($obsoleteAiSetting)) {
            throw "Obsolete AI setting '$obsoleteAiSetting' remains configured."
        }
    }
    foreach ($entry in $expectedAuthSettings.GetEnumerator()) {
        if ($configuredByName[$entry.Key] -ne $entry.Value) {
            throw "Web app authentication setting '$($entry.Key)' was not persisted."
        }
    }
    if ($emailAccessMode -eq 'connection-string' -and -not $configuredByName.ContainsKey('HOST_EMAIL_CONNECTION_STRING')) {
        throw 'ACS connection-string fallback was selected but the setting was not persisted.'
    }
    if ($emailAccessMode -ne 'connection-string' -and $configuredByName.ContainsKey('HOST_EMAIL_CONNECTION_STRING')) {
        throw 'HOST_EMAIL_CONNECTION_STRING remains configured while managed identity is enabled.'
    }
    if ($allowLegacyPassphrase -and -not $configuredByName.ContainsKey('HOST_PASSPHRASE')) {
        throw 'Emergency host passphrase was enabled but not persisted.'
    }
    if (-not $allowLegacyPassphrase -and $configuredByName.ContainsKey('HOST_PASSPHRASE')) {
        throw 'HOST_PASSPHRASE remains configured while the emergency fallback is disabled.'
    }
    if (-not $configuredByName.ContainsKey('ADMIN_PASSPHRASE')) {
        throw 'ADMIN_PASSPHRASE was not persisted.'
    }

    $site = Invoke-Az -CliArguments @('webapp', 'show', '--resource-group', $resourceGroup, '--name', $app,
        '--query', '{httpsOnly:httpsOnly}') | ConvertFrom-Json
    $config = Invoke-Az -CliArguments @('webapp', 'config', 'show', '--resource-group', $resourceGroup, '--name', $app,
        '--query', '{alwaysOn:alwaysOn,healthCheckPath:healthCheckPath,appCommandLine:appCommandLine,linuxFxVersion:linuxFxVersion}') | ConvertFrom-Json
    $mismatches = @()
    if (-not $site.httpsOnly) { $mismatches += 'httpsOnly' }
    if (-not $config.alwaysOn) { $mismatches += 'alwaysOn' }
    if ($config.appCommandLine -ne $startupCommand) { $mismatches += 'appCommandLine' }
    if ($config.linuxFxVersion -ine 'NODE|24-lts') { $mismatches += 'linuxFxVersion' }
    if ($mismatches.Count -gt 0) {
        throw "Web app configuration verification failed ($($mismatches -join ', ')); deployment was not attempted."
    }
    if ($config.healthCheckPath -ne '/healthz') {
        if (-not $healthConfigIssue) { $healthConfigIssue = "Azure configuration still reports '$($config.healthCheckPath)'." }
    }
    if ($healthConfigIssue) {
        Write-Warning "App Service platform Health check is NOT confirmed enabled: $healthConfigIssue The app's /healthz endpoint will still be checked over HTTPS after deployment."
    }
    try {
        Invoke-Az -CliArguments @('webapp', 'deploy', '--resource-group', $resourceGroup, '--name', $app, '--src-path', $zipPath,
            '--type', 'zip', '--timeout', '600000') -Format none
    } catch {
        Write-Warning "Azure's deployment gateway returned an error; checking the deployed application before treating it as a failure. $($_.Exception.Message)"
    }

    $ready = $false
    for ($attempt = 0; $attempt -lt 18; $attempt++) {
        try {
            $health = Invoke-WebRequest -UseBasicParsing -Uri "$url/healthz" -TimeoutSec 15
            if ($health.StatusCode -eq 200 -and $health.Content.Trim() -eq 'ok') { $ready = $true; break }
        } catch { }
        Start-Sleep -Seconds 10
    }
    if (-not $ready) { throw "Health check did not return 200 at $url/healthz. Inspect deployment and app logs." }
    $missingSessionRejected = $false
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "$url/qr" -TimeoutSec 15 -ErrorAction Stop | Out-Null
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 404) { $missingSessionRejected = $true }
        else { throw }
    }
    if (-not $missingSessionRejected) { throw 'QR endpoint accepted a request without a quiz session.' }
    $playerPage = Invoke-WebRequest -UseBasicParsing -Uri "$url/play" -TimeoutSec 15
    $hostPage = Invoke-WebRequest -UseBasicParsing -Uri "$url/host.html" -TimeoutSec 15
    $adminPage = Invoke-WebRequest -UseBasicParsing -Uri "$url/admin.html" -TimeoutSec 15
    if ($playerPage.StatusCode -ne 200 -or $hostPage.StatusCode -ne 200 -or
        $adminPage.StatusCode -ne 200 -or $adminPage.Content -notmatch 'Quiz administration') {
        throw 'Player, host, or admin page did not return the expected HTTP 200 content.'
    }
    $adminProtected = $false
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "$url/api/admin/overview" -TimeoutSec 15 -ErrorAction Stop | Out-Null
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 401) { $adminProtected = $true }
        else { throw }
    }
    if (-not $adminProtected) { throw 'Admin overview was accessible without authentication.' }
    $rootPage = Invoke-WebRequest -UseBasicParsing -Uri "$url/" -TimeoutSec 15
    if ($rootPage.StatusCode -ne 200 -or $rootPage.Content -notmatch 'Host sign in') {
        throw "The deployment root $url/ did not serve the host page."
    }
    Write-Host "Deployment verified in subscription $Subscription."
    Write-Host "Name suffix: $NameSuffix; resource group: $resourceGroup; plan: $plan; web app: $app"
    Write-Host "Player join links are generated per host session from: $url/play"
    Write-Host "Host link: $url/"
    Write-Warning "The App Service plan bills until the plan is deleted. Stopping the web app does not stop billing. Run teardown.ps1 separately after the event."
} catch {
    if ($billablePossible) {
        Write-Warning "Deployment failed or remains unverified. The App Service plan in $resourceGroup may still bill until the plan is deleted; inspect it and run the separately confirmed teardown only when safe."
    }
    throw
} finally {
    $passphrase = $null
    $adminPassphrase = $null
    $communicationConnectionString = $null
    $token = $null
    [Environment]::SetEnvironmentVariable('HOST_PASSPHRASE', $null, 'Process')
    [Environment]::SetEnvironmentVariable('ADMIN_PASSPHRASE', $null, 'Process')
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    if ($stagePath -and (Test-Path -LiteralPath $stagePath)) { Remove-Item -LiteralPath $stagePath -Recurse -Force -ErrorAction SilentlyContinue }
}
