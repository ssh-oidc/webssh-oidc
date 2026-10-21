import type { PageLoad } from './$types';

export const load = (({ data }) => {
	return {
		providers: data?.providers || {},
		config: data?.config
	};
}) satisfies PageLoad;
