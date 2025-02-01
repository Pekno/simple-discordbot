export interface ApiRequest {
	url: string;
	options: any;
	resolve: (value: any) => void;
	reject: (reason?: any) => void;
}
