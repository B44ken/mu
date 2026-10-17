import { ReactNode, useEffect, useState } from 'react'

const auth = 'https://uoftauth.boratto.ca'
type User = { id: string, email: string | null, name: string | null }

export const RepoGate = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>()
    const [error, setError] = useState('')

    useEffect(() => {
        fetch(`${auth}/me`, { credentials: 'include' })
            .then(response => {
                if (!response.ok) throw new Error(`sign-in check failed: ${response.status}`)
                return response.json()
            })
            .then(setUser)
            .catch(error => setError(error.message))
    }, [])

    if (error) return <p role='alert'>{error}</p>
    if (user === undefined) return <p className='text-center'>loading…</p>
    if (user) return <>{children}</>
    return <div className='text-center my-3'>
        <a className='btn btn-primary' href={`${auth}/login?domain=${encodeURIComponent(window.location.href)}`}>sign in with uoft</a>
    </div>
}
