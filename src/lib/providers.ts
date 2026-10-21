import logo_google from '$lib/assets/provider-logos/google.png';
import logo_deephdc from '$lib/assets/provider-logos/deephdc.png';
import logo_egi from '$lib/assets/provider-logos/egi.png';
import logo_helmholtz from '$lib/assets/provider-logos/helmholtz.png';
import logo_wlcg from '$lib/assets/provider-logos/wlcg.jpeg';
import logo_eduteams from '$lib/assets/provider-logos/eduteams.png';
import logo_generic from '$lib/assets/provider-logos/oidc.png';
import logo_nfdi_infra from '$lib/assets/provider-logos/nfdi.png';
import logo_kit from '$lib/assets/provider-logos/kit.png';

export type Provider = {
	name?: string;
	logo: string;
};

export const providers: Record<string, Provider> = {
	'https://accounts.google.com': {
		name: 'Google',
		logo: logo_google
	},
	'https://iam.deep-hybrid-datacloud.eu': {
		name: 'DEEP Hybrid Data Cloud',
		logo: logo_deephdc
	},
	'https://aai.egi.eu/auth/realms/egi': {
		name: 'EGI',
		logo: logo_egi
	},
	'https://aai-dev.egi.eu/auth/realms/egi': {
		name: 'EGI dev',
		logo: logo_egi
	},
	'https://aai-demo.egi.eu/auth/realms/egi': {
		name: 'EGI demo',
		logo: logo_egi
	},
	'https://login.helmholtz.de/oauth2': {
		name: 'Helmholtz ID',
		logo: logo_helmholtz
	},
	'https://login-dev.helmholtz.de/oauth2': {
		name: 'Helmholtz ID dev',
		logo: logo_helmholtz
	},
	'https://wlcg.cloud.cnaf.infn.it': {
		name: 'WLCG',
		logo: logo_wlcg
	},
	'https://proxy.eduteams.org': {
		name: 'eduTEAMS',
		logo: logo_eduteams
	},
	'https://infraproxy.nfdi-aai.dfn.de': {
		name: 'NFDI Infrastructure Proxy',
		logo: logo_nfdi_infra
	},
	'https://oidc.scc.kit.edu/auth/realms/kit': {
		name: 'KIT IdP',
		logo: logo_kit
	},
	'https://fels.scc.kit.edu/oidc/realms/fels': {
		name: 'KIT Fels',
		logo: logo_kit
	},
	'https://proxy.myaccessid.org': {
		name: 'MyAccessID',
		logo: logo_generic
	},
	'https://auth.didmos.nfdi-aai.de': {
		name: 'didmos',
		logo: logo_generic
	},
	'https://keycloak.sso.gwdg.de/auth/realms/academiccloud': {
		name: 'Academic ID',
		logo: logo_generic
	},
	'https://login.aai.lifescience-ri.eu/oidc': {
		name: 'LSAAI',
		logo: logo_generic
	}
};

export const generic: Provider = {
	name: 'OIDC Provider',
	logo: logo_generic
};
