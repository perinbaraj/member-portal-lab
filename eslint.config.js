import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: ["dist/**", "node_modules/**", "lab-guide/**"],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	...tseslint.configs.strict,
	{
		files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
		rules: {
			"no-console": ["error", { allow: ["warn", "error"] }],
		},
	}
);
