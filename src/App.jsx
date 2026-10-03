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

// Estimación de tokens (~4 caracteres por token). Es una aproximación:
// el tokenizador exacto depende del modelo que use Puter por defecto.
function estimateTokens(text) {
  const str = String(text ?? '')
  if (!str) return 0
  return Math.ceil(str.length / 4)
}

// Texto del prompt enviado, sea un string o un array de mensajes (modo contexto).
function requestText(request) {
  const args = request?.data?.arguments
  if (!args) return ''
  if (typeof args.prompt === 'string') return args.prompt
  if (Array.isArray(args.messages)) {
    return args.messages.map((m) => String(m?.content ?? '')).join('\n')
  }
  return ''
}

export default function App() {
  const [messages, setMessages] = useState([])
  const [requests, setRequests] = useState([])
  const [responses, setResponses] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [useContext, setUseContext] = useState(() => {
    try {
      return localStorage.getItem('cb_useContext') === '1'
    } catch {
      return false
    }
  })
  const [useSkill, setUseSkill] = useState(() => {
    try {
      return localStorage.getItem('cb_useSkill') === '1'
    } catch {
      return false
    }
  })
  const [useCaveman, setUseCaveman] = useState(() => {
    try {
      return localStorage.getItem('cb_useCaveman') === '1'
    } catch {
      return false
    }
  })

  const lastRequest = requests.length > 0 ? requests[requests.length - 1] : null
  const lastResponse = responses.length > 0 ? responses[responses.length - 1] : null
  const lastPromptText = requestText(lastRequest)
  const lastAnswer =
    lastResponse && !lastResponse.data.error
      ? String(lastResponse.data.message?.content ?? '')
      : null

  function toggleContext(event) {
    const checked = event.target.checked
    setUseContext(checked)
    try {
      localStorage.setItem('cb_useContext', checked ? '1' : '0')
    } catch {
      /* sin almacenamiento disponible */
    }
  }

  function toggleSkill(event) {
    const checked = event.target.checked
    setUseSkill(checked)
    try {
      localStorage.setItem('cb_useSkill', checked ? '1' : '0')
    } catch {
      /* sin almacenamiento disponible */
    }
  }

  function toggleCaveman(event) {
    const checked = event.target.checked
    setUseCaveman(checked)
    try {
      localStorage.setItem('cb_useCaveman', checked ? '1' : '0')
    } catch {
      /* sin almacenamiento disponible */
    }
  }

  async function sendMessage(event) {
    event.preventDefault()
    if (!text.trim() || loading) return

    const question = text.trim()
    const id = Date.now()
    const userMessage = { role: 'user', content: question }
    // Skills que modifican lo enviado al modelo.
    const skillMessages = []
    if (useCaveman) {
      skillMessages.push({
        role: 'system',
        content:
          'Responde únicamente con monosílabos en español: todas las palabras de tu respuesta deben tener una sola sílaba.',
      })
    }
    // Con contexto activado se envían los últimos 10 mensajes (pregunta incluida);
    // si no, solo la pregunta actual (más las skills activas).
    let promptToSend
    let args
    if (useContext || skillMessages.length > 0) {
      const history = useContext ? [...messages, userMessage].slice(-10) : [userMessage]
      promptToSend = [...skillMessages, ...history]
      args = { messages: promptToSend }
    } else {
      promptToSend = question
      args = { prompt: question }
    }
    const requestData = {
      method: 'puter.ai.chat',
      arguments: args,
    }

    setText('')
    setMessages((current) => [...current, userMessage])
    setRequests((current) => [...current, { id, data: requestData }])
    setLoading(true)

    try {
      const response = await window.puter.ai.chat(promptToSend)
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
      <header className="app-header">
        <h1>Chatbot</h1>
        <label
          className="header-toggle"
          title="Si está activado, en cada petición se envían los últimos 10 mensajes como contexto"
        >
          <input type="checkbox" checked={useContext} onChange={toggleContext} />
          Contexto (10)
        </label>
        <label
          className="header-toggle"
          title="Si está activado, las respuestas del bot se muestran en rojo"
        >
          <input type="checkbox" checked={useSkill} onChange={toggleSkill} />
          skill rojo
        </label>
        <label
          className="header-toggle"
          title="Si está activado, el modelo responde solo con monosílabos"
        >
          <input type="checkbox" checked={useCaveman} onChange={toggleCaveman} />
          skill cavernícola
        </label>
      </header>

      <div className="debug-layout">
        <section className="log-panel">
          <h2>Petición enviada</h2>
          <div className="log-list">
            {requests.length === 0 && <p className="empty">Todavía no hay peticiones.</p>}
            {requests.map((request, index) => (
              <article key={request.id}>
                <h3>Petición #{index + 1}</h3>
                <pre>{formatJson(request.data)}</pre>
              </article>
            ))}
          </div>
          <footer className="context-box">
            <h3>Contexto de entrada</h3>
            {lastRequest ? (
              <p className="token-count" title="Estimación: ~4 caracteres por token">
                ~{estimateTokens(lastPromptText)} <span>tokens</span>
              </p>
            ) : (
              <p className="empty">Todavía no hay contexto de entrada.</p>
            )}
          </footer>
        </section>

        <section className="chat-panel">
          <div className="messages">
            {messages.map((message, index) => {
              const cls =
                message.role === 'assistant' && useSkill ? 'assistant skill-on' : message.role
              return (
                <p key={index} className={cls}>
                  <strong>{message.role === 'user' ? 'Tú' : 'Bot'}:</strong>{' '}
                  {message.content}
                </p>
              )
            })}
            {loading && <p>El bot está escribiendo...</p>}
          </div>

          <form onSubmit={sendMessage}>
            <input
              type="text"
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
          <div className="log-list">
            {responses.length === 0 && <p className="empty">Todavía no hay respuestas.</p>}
            {responses.map((response, index) => (
              <article key={response.id}>
                <h3>Respuesta #{index + 1}</h3>
                <pre>{formatJson(response.data)}</pre>
              </article>
            ))}
          </div>
          <footer className="context-box">
            <h3>Contexto de salida</h3>
            {lastAnswer !== null ? (
              <p className="token-count" title="Estimación: ~4 caracteres por token">
                ~{estimateTokens(lastAnswer)} <span>tokens</span>
              </p>
            ) : (
              <p className="empty">
                {lastResponse ? 'La última respuesta fue un error.' : 'Todavía no hay contexto de salida.'}
              </p>
            )}
          </footer>
        </section>
      </div>
    </main>
  )
}
