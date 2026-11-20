export async function onRequest(context: any) {
    const { results } = await (context.env.DB as D1Database).prepare(
        'SELECT id, pdf, preview, course, session, type, number, practice, solutions FROM files WHERE approved ORDER BY course, session DESC, type, number'
    ).all()
    return Response.json(results.map(r => ({ ...r, practice: !!r.practice, solutions: !!r.solutions })))
}
