import { handleAuth, type AuthEnvironment } from '../../../lib/auth'

export const onRequest: PagesFunction<AuthEnvironment> = ({ request, env }) => handleAuth(request, env)
