[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9]{10}$')]
    [string]$NameSuffix,
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,
    [Parameter(Mandatory = $true)]
    [string]$ConfirmResourceGroupName,
    [ValidateSet('ea8de45a-97c7-4e6c-81f1-6cae597e83bb')]
    [string]$Subscription = 'ea8de45a-97c7-4e6c-81f1-6cae597e83bb'
)

$ErrorActionPreference = 'Stop'
$expectedGroup = "rg-livequiz-ci-$NameSuffix"
$expectedPlan = "asp-livequiz-ci-$NameSuffix"
$expectedApp = 'solution-engineer-quiz'
$expectedCosmos = "cosmoslivequiz$NameSuffix"
$expectedInsights = "appi-livequiz-ci-$NameSuffix"
$expectedVnet = "vnet-livequiz-$NameSuffix"
$expectedAcs = "acs-livequiz-$NameSuffix"
$expectedEmail = "email-livequiz-$NameSuffix"
$expectedPrivateEndpoint = 'pe-cosmos-livequiz'
$expectedPrivateDns = 'privatelink.documents.azure.com'

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

if ($ResourceGroupName -cne $expectedGroup -or $ConfirmResourceGroupName -cne $expectedGroup) {
    throw "Both -ResourceGroupName and -ConfirmResourceGroupName must exactly equal $expectedGroup."
}
if (-not (Get-Command az -ErrorAction SilentlyContinue)) { throw 'Azure CLI (az) is required.' }
$account = Invoke-Az -CliArguments @('account', 'show') | ConvertFrom-Json
if ($account.id -ine $Subscription) { throw "Subscription $Subscription is unavailable to this Azure CLI login." }
$exists = Invoke-Az -CliArguments @('group', 'exists', '--name', $expectedGroup) -Format tsv
if ($exists -ne 'true') { throw "Resource group $expectedGroup does not exist (or could not be verified); nothing was deleted." }
$group = Invoke-Az -CliArguments @('group', 'show', '--name', $expectedGroup) | ConvertFrom-Json
if ($group.location -ne 'centralindia') { throw 'Resource group location differs from centralindia; nothing was deleted.' }

$resources = @(Invoke-Az -CliArguments @('resource', 'list', '--resource-group', $expectedGroup) | ConvertFrom-Json)
if ($resources.Count -eq 0) { throw 'The resource group is empty; nothing was deleted.' }
$plan = $null
$app = $null
foreach ($resource in $resources) {
    $knownRegional =
        ($resource.type -ieq 'Microsoft.Web/serverfarms' -and $resource.name -ceq $expectedPlan) -or
        ($resource.type -ieq 'Microsoft.Web/sites' -and $resource.name -ceq $expectedApp) -or
        ($resource.type -ieq 'Microsoft.DocumentDB/databaseAccounts' -and $resource.name -ceq $expectedCosmos) -or
        ($resource.type -ieq 'Microsoft.Network/virtualNetworks' -and $resource.name -ceq $expectedVnet) -or
        ($resource.type -ieq 'Microsoft.Network/privateEndpoints' -and $resource.name -ceq $expectedPrivateEndpoint) -or
        ($resource.type -ieq 'Microsoft.Network/networkInterfaces' -and $resource.name -like "$expectedPrivateEndpoint.nic.*") -or
        ($resource.type -ieq 'Microsoft.Insights/components' -and $resource.name -ceq $expectedInsights)
    $knownGlobal =
        ($resource.type -ieq 'Microsoft.Communication/CommunicationServices' -and $resource.name -ceq $expectedAcs) -or
        ($resource.type -ieq 'Microsoft.Communication/EmailServices' -and $resource.name -ceq $expectedEmail) -or
        ($resource.type -ieq 'Microsoft.Communication/EmailServices/Domains' -and $resource.name -like "$expectedEmail/AzureManagedDomain") -or
        ($resource.type -ieq 'Microsoft.Network/privateDnsZones' -and $resource.name -ceq $expectedPrivateDns) -or
        ($resource.type -ieq 'Microsoft.Network/privateDnsZones/virtualNetworkLinks' -and $resource.name -like "$expectedPrivateDns/*")
    if ($knownRegional) {
        if ($resource.location -ne 'centralindia') { throw "Unexpected regional location for $($resource.type)/$($resource.name); nothing was deleted." }
    } elseif ($knownGlobal) {
        if ($resource.location -ne 'global') { throw "Unexpected global location for $($resource.type)/$($resource.name); nothing was deleted." }
    } else {
        throw "Unexpected resource $($resource.type)/$($resource.name) in $expectedGroup; nothing was deleted."
    }
    if ($resource.type -ieq 'Microsoft.Web/serverfarms' -and $resource.name -ceq $expectedPlan) { $plan = $resource }
    if ($resource.type -ieq 'Microsoft.Web/sites' -and $resource.name -ceq $expectedApp) { $app = $resource }
}
if ($plan) {
    $planDetails = Invoke-Az -CliArguments @('resource', 'show', '--ids', $plan.id, '--api-version', '2022-03-01') | ConvertFrom-Json
    if (-not $planDetails.properties.reserved -or $planDetails.id -ine $plan.id -or
        $planDetails.sku.capacity -ne 1) {
        throw 'Plan is not the expected Linux App Service plan; nothing was deleted.'
    }
}
if ($app) {
    if (-not $plan) { throw 'Web app exists without its expected plan; nothing was deleted.' }
    $appDetails = Invoke-Az -CliArguments @('resource', 'show', '--ids', $app.id, '--api-version', '2022-03-01') | ConvertFrom-Json
    if ($appDetails.id -ine $app.id -or $appDetails.properties.serverFarmId -ine $plan.id) {
        throw 'Web app is not attached to the expected plan; nothing was deleted.'
    }
}

Write-Host "Deleting ONLY $expectedGroup in subscription $Subscription (Central India)."
Write-Host "Expected resources: $(@($resources | ForEach-Object { "$($_.type)/$($_.name)" }) -join ', ')"
Write-Warning 'Stopping the app or deleting only the app does NOT stop plan billing. This removes the entire resource group, including the plan, Cosmos DB, telemetry, durable batches, and any in-memory game state.'
Invoke-Az -CliArguments @('group', 'delete', '--name', $expectedGroup, '--yes') -Format none
$stillExists = Invoke-Az -CliArguments @('group', 'exists', '--name', $expectedGroup) -Format tsv
if ($stillExists -ne 'false') { throw "Resource group $expectedGroup still exists; check Azure for ongoing plan billing." }
Write-Host "Verified $expectedGroup and its billed plan were deleted."
