import { isAuthConfigured, type AuthEnvironment } from '../../lib/auth'

export const onRequestGet: PagesFunction<AuthEnvironment> = ({ env }) =>
    Response.json({ ready: isAuthConfigured(env) }, { headers: { 'Cache-Control': 'no-store' } })
