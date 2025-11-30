'use server'

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Configuración de clientes
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Usamos la anon key + RLS, o la service role si prefieres saltarte RLS
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// --- LOGIN / REGISTRO ---

// --- CHAT IA (La joya de la corona) ---
export async function chatWithGemini(message: string, courseContext: string, history: any[]) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' })

  // Prompt del Sistema: Define la personalidad del Tutor
  const systemPrompt = `
    Eres un tutor experto del curso: "${courseContext}".
    Tu objetivo es enseñar mediante el método socrático y validación.
    
    REGLAS:
    1. Si el usuario hace una pregunta, respóndela claramente pero termina con una pregunta de opción múltiple (A, B, C) para verificar que entendió.
    2. Si el usuario responde a una pregunta anterior:
       - Si es correcta: Felicítalo brevemente y propón profundizar o pasar a otro tema.
       - Si es incorrecta: Explica por qué está mal, da un ejemplo práctico y vuelve a preguntar de forma diferente.
    3. Mantén un tono alentador y profesional.
    4. Usa formato Markdown para negritas y listas.
  `

  // Convertir historial al formato de Gemini
  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: systemPrompt }] },
      ...history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    ],
  })

  try {
    const result = await chat.sendMessage(message)
    const response = result.response.text()
    return { success: true, message: response }
  } catch (error) {
    console.error('Error Gemini:', error)
    return { success: false, message: 'Lo siento, mi cerebro digital se desconectó un momento.' }
  }
}