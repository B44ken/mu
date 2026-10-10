import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, before, test } from 'node:test'
import { promisify } from 'node:util'
import { encode } from '@auth/core/jwt'
import { Miniflare } from 'miniflare'

const origin = 'https://mu.example'
const cookieName = '__Secure-authjs.session-token'
const env = {
    AUTH_SECRET: 'test-only-secret-with-at-least-thirty-two-characters',
    AUTH_MICROSOFT_ENTRA_ID_ID: 'test-only-client-id',
    AUTH_MICROSOFT_ENTRA_ID_SECRET: 'test-only-client-secret'
}
const user = { id: '78aac226-2f03-4b4d-9037-b46d56c55210:test-student', email: 'student@mail.utoronto.ca', name: 'test student' }
const filename = 'CSC108-2025-Test_Exam-final.pdf'
const pdf = '%PDF-1.4\ntest repository document\n%%EOF'
let directory: string
let runtime: Miniflare
let sessionCookie: string

function createRuntime(bindings = env) {
    return new Miniflare({
        modules: true,
        modulesRoot: directory,
        scriptPath: join(directory, 'index.js'),
        compatibilityDate: '2026-03-05',
        bindings,
        r2Buckets: { BUCKET: 'muoft' }
    })
}

async function session(secret = env.AUTH_SECRET, maxAge = 3600) {
    const token = await encode({
        token: { sub: user.id, email: user.email, name: user.name },
        secret, salt: cookieName, maxAge
    })
    return `${cookieName}=${token}`
}

async function assertLocked(worker: Miniflare, cookie = '') {
    for (const path of ['/api/me', '/api/repo', '/api/repo/', `/api/repo/${filename}`]) {
        const response = await worker.dispatchFetch(`${origin}${path}`, { headers: { Cookie: cookie } })
        assert.equal(response.status, 401, path)
        assert.match(response.headers.get('cache-control')!, /no-store/)
    }
    const upload = await worker.dispatchFetch(`${origin}/api/repo/upload?filename=denied.pdf`, {
        method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/pdf' }, body: pdf
    })
    assert.equal(upload.status, 401)
    assert.match(upload.headers.get('cache-control')!, /no-store/)
    assert.equal(await (await worker.getR2Bucket('BUCKET')).get('submit/denied.pdf'), null)
}

before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'mu-repo-test-'))
    await promisify(execFile)(process.execPath, [
        resolve('node_modules/wrangler/bin/wrangler.js'), 'pages', 'functions', 'build',
        '--outdir', directory
    ], { env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } })
    runtime = createRuntime()
    await (await runtime.getR2Bucket('BUCKET')).put(filename, pdf, { httpMetadata: { contentType: 'application/pdf' } })
    sessionCookie = await session()
})

after(async () => {
    await runtime.dispose()
    await rm(directory, { recursive: true })
})

test('anonymous requests cannot list, download, or upload repository files', async () => {
    await assertLocked(runtime)
})

test('the generated auth and account routes recognize a valid encrypted session', async () => {
    const config = await runtime.dispatchFetch(`${origin}/api/config`)
    assert.equal(config.status, 200)
    assert.deepEqual(await config.json(), { ready: true })
    const account = await runtime.dispatchFetch(`${origin}/api/me`, { headers: { Cookie: sessionCookie } })
    assert.equal(account.status, 200)
    assert.equal(account.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await account.json(), { user })
    const auth = await runtime.dispatchFetch(`${origin}/api/auth/session`, { headers: { Cookie: sessionCookie } })
    assert.equal(auth.status, 200)
    assert.deepEqual((await auth.json() as { user: unknown }).user, user)
})

test('authenticated requests list and download the seeded R2 document', async () => {
    const listing = await runtime.dispatchFetch(`${origin}/api/repo`, { headers: { Cookie: sessionCookie } })
    assert.equal(listing.status, 200)
    assert.equal(listing.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(await listing.json(), [{ course: 'CSC108', year: 2025, name: 'Test Exam', tags: ['final'], file: filename }])
    const download = await runtime.dispatchFetch(`${origin}/api/repo/${filename}`, { headers: { Cookie: sessionCookie } })
    assert.equal(download.status, 200)
    assert.equal(download.headers.get('content-type'), 'application/pdf')
    assert.equal(download.headers.get('content-disposition'), 'inline')
    assert.equal(download.headers.get('cache-control'), 'private, no-store')
    assert.equal(await download.text(), pdf)
})

test('an authenticated upload reaches R2 with its bytes and content type', async () => {
    const response = await runtime.dispatchFetch(`${origin}/api/repo/upload?filename=accepted.pdf`, {
        method: 'POST', headers: { Cookie: sessionCookie, 'Content-Type': 'application/pdf', 'Content-Length': String(Buffer.byteLength(pdf)) }, body: pdf
    })
    assert.equal(response.status, 200, await response.text())
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    const stored = await (await runtime.getR2Bucket('BUCKET')).get('submit/accepted.pdf')
    assert.equal(await stored!.text(), pdf)
    assert.equal(stored!.httpMetadata!.contentType, 'application/pdf')
})

test('forged and expired sessions cannot access any repository route', async () => {
    await assertLocked(runtime, await session('wrong-test-only-secret'))
    await assertLocked(runtime, await session(env.AUTH_SECRET, -60))
})

test('missing AUTH_SECRET keeps the entire repository locked', async (t) => {
    const unconfigured = createRuntime({ ...env, AUTH_SECRET: '' })
    t.after(() => unconfigured.dispose())
    await (await unconfigured.getR2Bucket('BUCKET')).put(filename, pdf)
    await assertLocked(unconfigured, sessionCookie)
    const config = await unconfigured.dispatchFetch(`${origin}/api/config`)
    assert.deepEqual(await config.json(), { ready: false })
    const auth = await unconfigured.dispatchFetch(`${origin}/api/auth/csrf`)
    assert.equal(auth.status, 503)
})

test('sign-out requires CSRF and expires the browser session before protecting repository routes again', async () => {
    const cookies = new Map([[cookieName, sessionCookie.slice(cookieName.length + 1)]])
    const header = () => Array.from(cookies, ([key, value]) => `${key}=${value}`).join('; ')
    const rejected = await runtime.dispatchFetch(`${origin}/api/auth/signout`, {
        method: 'POST', redirect: 'manual', headers: { Cookie: header() }, body: new URLSearchParams({ callbackUrl: `${origin}/repo` })
    })
    assert.equal(rejected.status, 302)
    assert.match(rejected.headers.get('location')!, /error=MissingCSRF/)
    assert.equal((await runtime.dispatchFetch(`${origin}/api/me`, { headers: { Cookie: header() } })).status, 200)

    const csrf = await runtime.dispatchFetch(`${origin}/api/auth/csrf`, { headers: { Cookie: header() } })
    for (const cookie of csrf.headers.getSetCookie()) {
        const pair = cookie.split(';', 1)[0]
        const index = pair.indexOf('=')
        cookies.set(pair.slice(0, index), pair.slice(index + 1))
    }
    const { csrfToken } = await csrf.json() as { csrfToken: string }
    const response = await runtime.dispatchFetch(`${origin}/api/auth/signout`, {
        method: 'POST', redirect: 'manual', headers: { Cookie: header() }, body: new URLSearchParams({ csrfToken, callbackUrl: `${origin}/repo` })
    })
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('location'), `${origin}/repo`)
    const deleted = response.headers.getSetCookie().find(cookie => cookie.startsWith(`${cookieName}=`))!
    assert.match(deleted, /Max-Age=0/)
    cookies.set(cookieName, deleted.split(';', 1)[0].slice(cookieName.length + 1))
    await assertLocked(runtime, header())
})
