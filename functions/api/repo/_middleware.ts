import { getSession, type AuthEnvironment } from '../../../lib/auth'

export const onRequest: PagesFunction<AuthEnvironment> = async ({ request, env, next }) => {
    if (!await getSession(request, env)) return Response.json({ error: 'not signed in' }, {
        status: 401,
        headers: { 'Cache-Control': 'no-store' }
    })

    const response = await next()
    response.headers.set('Cache-Control', 'private, no-store')
    return response
}
