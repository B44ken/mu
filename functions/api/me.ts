import { getSession, type AuthEnvironment } from '../../lib/auth'

export const onRequestGet: PagesFunction<AuthEnvironment> = async ({ request, env }) => {
    const session = await getSession(request, env)
    return Response.json(session ? { user: session.user } : { error: 'not signed in' }, {
        status: session ? 200 : 401,
        headers: { 'Cache-Control': 'no-store' }
    })
}
