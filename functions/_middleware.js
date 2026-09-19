function requestId(request) {
  const incoming = String(request.headers.get('X-Pathwise-Request-Id') || '').trim();
  if (/^[A-Za-z0-9_-]{8,80}$/.test(incoming)) return incoming;
  return `pw_srv_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
}

export async function onRequest({ request, next }) {
  const id = requestId(request);
  try {
    const response = await next();
    const wrapped = new Response(response.body, response);
    wrapped.headers.set('X-Pathwise-Request-Id', id);
    wrapped.headers.set('Access-Control-Expose-Headers', 'X-Pathwise-Request-Id');
    if (response.status >= 400) console.warn('Pathwise API request failed', { requestId:id, status:response.status });
    return wrapped;
  } catch (error) {
    console.error('Pathwise API request crashed', { requestId:id, name:error?.name || 'Error' });
    return new Response(JSON.stringify({ error:'服务暂时不可用', requestId:id }), {
      status: 500,
      headers: {
        'Content-Type':'application/json; charset=utf-8',
        'X-Pathwise-Request-Id':id,
        'Access-Control-Expose-Headers':'X-Pathwise-Request-Id'
      }
    });
  }
}
