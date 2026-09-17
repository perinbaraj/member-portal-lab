type CachedToken = {
	accessToken: string;
	expiresAt: number;
};

export class OAuthTokenService {
	private cachedToken: CachedToken | null = null;

	async getAccessToken(): Promise<string> {
		const now = Date.now();
		if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
			return this.cachedToken.accessToken;
		}

		const token = process.env.PHARMACY_SERVICE_ACCESS_TOKEN || "dev-pharmacy-token";
		this.cachedToken = {
			accessToken: token,
			expiresAt: now + 60 * 60 * 1000,
		};

		return token;
	}
}