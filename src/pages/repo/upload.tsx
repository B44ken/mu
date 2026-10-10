import { useState } from 'react'
import { Breadcrumbs, SiteFooter, SiteHeader } from '../../components/common'
import { RepoGate } from '../../components/auth'

const UploadForm = () => {
    const [msgs, setMsgs] = useState<string[]>([])
    const inp = (event: React.ChangeEvent<HTMLInputElement>) => {
        Array.from(event.target.files as FileList).forEach(f => {
            fetch(`/api/repo/upload?filename=${encodeURIComponent(f.name)}`, {
                method: 'POST', body: f,
                headers: { 'Content-Type': f.type }
            }).then(r => r.text()).then(m => setMsgs([...msgs, `${f.name}, ${m}`]))
        })
    }

    return <>
        <div style={{ textAlign: 'center', padding: '3%' }}>
            <h3>Upload a file (or multiple) </h3> <br />
            <input type="file" onInput={inp} multiple />
            {msgs.map(m => <p key={m}>{m}</p>)}
        </div>
    </>
}

export default () => <>
    <SiteHeader active="repo" />
    <Breadcrumbs crumbs={["Course Repository", "Upload"]} />
    <RepoGate><UploadForm /></RepoGate>
    <SiteFooter />
</>
