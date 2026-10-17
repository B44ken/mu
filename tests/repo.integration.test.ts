import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { after, before, test } from 'node:test'
import { promisify } from 'node:util'
import { Miniflare } from 'miniflare'

const origin = 'https://mu.example'
const filename = 'CSC108-2025-Test_Exam-final.pdf'
const pdf = '%PDF-1.4\ntest repository document\n%%EOF'
let directory: string
let runtime: Miniflare

before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'mu-repo-test-'))
    await promisify(execFile)(process.execPath, [
        resolve('node_modules/wrangler/bin/wrangler.js'), 'pages', 'functions', 'build',
        '--outdir', directory
    ], { env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } })
    runtime = new Miniflare({
        modules: true,
        modulesRoot: directory,
        scriptPath: join(directory, 'index.js'),
        compatibilityDate: '2026-03-05',
        r2Buckets: { BUCKET: 'muoft' }
    })
    const bucket = await runtime.getR2Bucket('BUCKET')
    await bucket.put(filename, pdf, { httpMetadata: { contentType: 'application/pdf' } })
    await bucket.put('MAT137-2024-Practice_Exam-midterm_solutions.pdf', pdf)
})

after(async () => {
    await runtime.dispose()
    await rm(directory, { recursive: true })
})

test('public repository routes list R2 documents with their metadata in year order', async () => {
    for (const path of ['/api/repo', '/api/repo/']) {
        const response = await runtime.dispatchFetch(`${origin}${path}`)
        assert.equal(response.status, 200, path)
        assert.deepEqual(await response.json(), [
            { course: 'MAT137', year: 2024, name: 'Practice Exam', tags: ['midterm', 'solutions'], file: 'MAT137-2024-Practice_Exam-midterm_solutions.pdf' },
            { course: 'CSC108', year: 2025, name: 'Test Exam', tags: ['final'], file: filename }
        ])
    }
})

test('a public download returns the seeded R2 document and its content type', async () => {
    const response = await runtime.dispatchFetch(`${origin}/api/repo/${filename}`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/pdf')
    assert.equal(response.headers.get('content-disposition'), 'inline')
    assert.equal(await response.text(), pdf)
})

test('a public upload stores the exact submitted bytes and content type in R2', async () => {
    const bytes = Uint8Array.from([...Buffer.from(pdf), 0, 128, 255])
    const response = await runtime.dispatchFetch(`${origin}/api/repo/upload?filename=accepted.pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(bytes.byteLength) },
        body: bytes
    })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'ok')
    const stored = await (await runtime.getR2Bucket('BUCKET')).get('submit/accepted.pdf')
    assert.ok(stored)
    assert.deepEqual(new Uint8Array(await stored.arrayBuffer()), bytes)
    assert.equal(stored.httpMetadata?.contentType, 'application/pdf')
})

test('a missing R2 document returns 404', async () => {
    const response = await runtime.dispatchFetch(`${origin}/api/repo/missing.pdf`)
    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Not found')
})
