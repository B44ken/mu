import { ReactNode, useEffect, useState } from 'react'

type User = { id: string, email: string, name: string | null }

export const RepoGate = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [ready, setReady] = useState(false)
    const [busy, setBusy] = useState(true)
    const [message, setMessage] = useState('')

    useEffect(() => {
        async function load() {
            const [config, session] = await Promise.all([fetch('/api/config'), fetch('/api/me')])
            if (!config.ok || ![200, 401].includes(session.status)) throw new Error('could not load sign-in. please refresh and try again.')
            setReady((await config.json() as { ready: boolean }).ready)
            if (session.ok) setUser((await session.json() as { user: User }).user)
            const error = new URLSearchParams(window.location.search).get('error')
            if (error) setMessage(error === 'AccessDenied'
                ? 'please use your university of toronto microsoft account.'
                : 'microsoft sign-in failed. please try again.')
        }
        load().catch(error => setMessage(error.message)).finally(() => setBusy(false))
    }, [])

    async function submitAuth(action: 'signin/microsoft-entra-id' | 'signout') {
        setBusy(true)
        setMessage('')
        try {
            const response = await fetch('/api/auth/csrf')
            if (!response.ok) throw new Error('microsoft sign-in is unavailable. please try again later.')
            const { csrfToken } = await response.json() as { csrfToken: string }
            const form = document.createElement('form')
            form.method = 'POST'
            form.action = `/api/auth/${action}`
            for (const [name, value] of Object.entries({ csrfToken, callbackUrl: window.location.origin + window.location.pathname })) {
                const input = document.createElement('input')
                input.type = 'hidden'
                input.name = name
                input.value = value
                form.appendChild(input)
            }
            document.body.appendChild(form)
            form.submit()
        } catch (error) {
            setMessage((error as Error).message)
            setBusy(false)
        }
    }

    return <>
        <div className='text-center my-3'>
            {user ? <>
                <span className='small text-muted me-3'>signed in as {user.email}</span>
                <button className='btn btn-outline-secondary btn-sm' disabled={busy} onClick={() => submitAuth('signout')}>sign out</button>
            </> : <>
                <p>sign in with your university of toronto microsoft account to access the course repository.</p>
                <button className='btn btn-primary' disabled={busy || !ready} onClick={() => submitAuth('signin/microsoft-entra-id')}>
                    {busy ? 'loading…' : 'sign in with microsoft'}
                </button>
                {!busy && !ready && !message && <p className='small text-muted mt-2'>microsoft sign-in is currently unavailable.</p>}
            </>}
            {message && <p className='mt-2' role='status'>{message}</p>}
        </div>
        {user && children}
    </>
}
