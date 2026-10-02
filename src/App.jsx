import { useState } from 'react'

function formatJson(value) {
  const seen = new WeakSet()

  return JSON.stringify(
    value,
    (_key, item) => {
      if (typeof item === 'bigint') return item.toString()
      if (typeof item === 'object' && item !== null) {
        if (seen.has(item)) return '[Circular]'
        seen.add(item)
      }
      return item
    },
    2,
  )
}

export default function App() {
  const [messages, setMessages] = useState([])
  const [requests, setRequests] = useState([])
  const [responses, setResponses] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendMessage(event) {
    event.preventDefault()
    if (!text.trim() || loading) return

    const question = text.trim()
    const id = Date.now()
    const requestData = {
      method: 'puter.ai.chat',
      arguments: {
        prompt: question,
      },
    }

    setText('')
    setMessages((current) => [...current, { role: 'user', content: question }])
    setRequests((current) => [...current, { id, data: requestData }])
    setLoading(true)

    try {
      const response = await window.puter.ai.chat(question)
      const answer = response.message.content.toString()
      setResponses((current) => [...current, { id, data: response }])
      setMessages((current) => [...current, { role: 'assistant', content: answer }])
    } catch (error) {
      setResponses((current) => [
        ...current,
        {
          id,
          data: {
            error: true,
            name: error?.name || 'Error',
            message: error?.message || 'No se pudo obtener una respuesta.',
          },
        },
      ])
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: 'No se pudo obtener una respuesta.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <h1>Chatbot</h1>

      <div className="debug-layout">
        <section className="log-panel">
          <h2>Petición enviada</h2>
          {requests.length === 0 && <p className="empty">Todavía no hay peticiones.</p>}
          {requests.map((request, index) => (
            <article key={request.id}>
              <h3>Petición #{index + 1}</h3>
              <pre>{formatJson(request.data)}</pre>
            </article>
          ))}
        </section>

        <section className="chat-panel">
          <div className="messages">
            {messages.map((message, index) => (
              <p key={index} className={message.role}>
                <strong>{message.role === 'user' ? 'Tú' : 'Bot'}:</strong>{' '}
                {message.content}
              </p>
            ))}
            {loading && <p>El bot está escribiendo...</p>}
          </div>

          <form onSubmit={sendMessage}>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Escribe un mensaje"
              autoFocus
            />
            <button disabled={loading}>Enviar</button>
          </form>
        </section>

        <section className="log-panel">
          <h2>Respuesta recibida</h2>
          {responses.length === 0 && <p className="empty">Todavía no hay respuestas.</p>}
          {responses.map((response, index) => (
            <article key={response.id}>
              <h3>Respuesta #{index + 1}</h3>
              <pre>{formatJson(response.data)}</pre>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
