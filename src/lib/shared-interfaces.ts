import type { ServiceConfig } from './domain-constants';

export interface UrlBuilderProps {
  envName: string;
  hostedZone: string;
}
export interface ApiUrlBuilderProps extends UrlBuilderProps {
  service: ServiceConfig;
}