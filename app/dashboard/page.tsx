'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { chatWithGemini } from '../actions'
import { 
  LogOut, Plus, Book, User, Send, Bot, 
  GraduationCap, BookOpen, Sun, Moon, 
  MoreVertical, Search, AlertCircle, RefreshCw, Wrench,
  Calendar as CalendarIcon, Lightbulb, Code as CodeIcon, Star,
  CheckCircle2, Play, Video, ExternalLink
} from 'lucide-react'
import { useTheme } from 'next-themes'

// --- TIPOS ---
type Profile = { id: string, role: 'student' | 'teacher', full_name: string, avatar_url?: string }
type CourseCategory = 'math' | 'programming' | 'letters' | 'other'

type Course = { 
  id: number, 
  title: string, 
  description: string, 
  category: CourseCategory,
  created_by: string,
  profiles?: { full_name: string }
}

type Session = {
  id: string,
  course_id: number,
  date: string,
  time: string,
  link: string
}

type Message = { 
  role: 'user' | 'model', 
  content: string, 
  timestamp?: Date,
  options?: string[], 
  isCodeRequest?: boolean 
}

export default function Dashboard() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Estados de carga y usuario
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [fixingProfile, setFixingProfile] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  
  // Estados de vista
  const [view, setView] = useState<'courses' | 'course_detail' | 'create'>('courses')
  
  // Datos
  const [courses, setCourses] = useState<Course[]>([])
  const [myCourses, setMyCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [courseSessions, setCourseSessions] = useState<Session[]>([])
  
  // Formularios Curso
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [newCourseDesc, setNewCourseDesc] = useState('')
  const [newCourseCategory, setNewCourseCategory] = useState<CourseCategory>('other')

  // Formularios Sesión
  const [sessionDate, setSessionDate] = useState('')
  const [sessionTime, setSessionTime] = useState('')
  const [sessionLink, setSessionLink] = useState('')
  const [showSessionForm, setShowSessionForm] = useState(false)
  
  // Chat
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [codeEditorVisible, setCodeEditorVisible] = useState(false) 
  const chatEndRef = useRef<HTMLDivElement>(null)

  // --- 1. CARGA INICIAL ---
  const fetchProfile = useCallback(async (currentUser: any, retries = 0) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        if (retries < 2) {
          setTimeout(() => fetchProfile(currentUser, retries + 1), 1500)
          return
        }
        setFixingProfile(true)
        await createMissingProfile(currentUser)
        return
      }

      setProfile(data)
      setLoadingProfile(false)
      fetchCourses(data.role, currentUser.id)

    } catch (err) {
      console.error("Error perfil:", err)
      setLoadingProfile(false)
    }
  }, [])

  const createMissingProfile = async (currentUser: any) => {
    try {
      const meta = currentUser.user_metadata || {}
      await supabase.from('profiles').insert({
        id: currentUser.id,
        full_name: meta.full_name || currentUser.email?.split('@')[0] || 'Usuario',
        role: meta.role || 'student',
        avatar_url: ''
      })
      window.location.reload()
    } catch (err) {
      console.error("Falló autocuración:", err)
    }
  }

  useEffect(() => {
    setMounted(true)
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)
      fetchProfile(user)
    }
    init()
  }, [router, fetchProfile])

  // --- 2. GESTIÓN DE CURSOS (LOGICA BLINDADA) ---
  const fetchCourses = async (role: string | undefined, userId: string) => {
    try {
      console.log("Cargando cursos para:", role)
      
      if (role === 'teacher') {
        // Intento 1: Con datos del perfil
        let { data, error } = await supabase.from('courses').select('*, profiles(full_name)').eq('created_by', userId)
        
        // Intento 2 (Fallback): Sin join si falla la relación
        if (error || !data) {
          console.warn("Fallo carga con perfil, intentando carga simple...", error)
          const simpleRes = await supabase.from('courses').select('*').eq('created_by', userId)
          data = simpleRes.data
        }
        
        setMyCourses(data || [])
      } else {
        // Estudiante: Cursos inscritos
        let { data: enrollData, error: enrollError } = await supabase
          .from('enrollments')
          .select('course_id, courses(*, profiles(full_name))')
          .eq('student_id', userId)

        if (enrollError) {
           console.warn("Fallo carga inscripciones con perfil, reintentando...", enrollError)
           const simpleEnroll = await supabase
            .from('enrollments')
            .select('course_id, courses(*)')
            .eq('student_id', userId)
           enrollData = simpleEnroll.data
        }

        const enrolled = enrollData?.map((e: any) => e.courses).filter(Boolean) || []
        setMyCourses(enrolled)
        
        // Todos los cursos (Explorar)
        let { data: allData, error: allError } = await supabase.from('courses').select('*, profiles(full_name)')
        if (allError) {
           const simpleAll = await supabase.from('courses').select('*')
           allData = simpleAll.data
        }
        setCourses(allData || [])
      }
    } catch (err) { 
      console.error("Error crítico fetchCourses:", err) 
    }
  }

  const createCourse = async () => {
    if (!profile || profile.role !== 'teacher') return
    try {
      const { error } = await supabase.from('courses').insert({
        title: newCourseTitle,
        description: newCourseDesc,
        category: newCourseCategory,
        created_by: user.id
      })
      if (error) throw error
      alert("Curso creado exitosamente")
      setNewCourseTitle('')
      setNewCourseDesc('')
      
      // Esperamos un poco y recargamos
      setTimeout(() => {
        fetchCourses('teacher', user.id)
        setView('courses')
      }, 500)
      
    } catch (error: any) { alert(error.message) }
  }

  const enrollCourse = async (courseId: number) => {
    const { error } = await supabase.from('enrollments').insert({ student_id: user.id, course_id: courseId })
    if (!error) {
      fetchCourses('student', user.id)
      alert("¡Inscrito correctamente!")
    }
  }

  // --- 3. GESTIÓN DE SESIONES (REAL) ---
  const fetchSessions = async (courseId: number) => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('course_id', courseId)
        .order('date', { ascending: true })
      
      if (!error && data) {
        setCourseSessions(data)
      } else {
        setCourseSessions([])
      }
    } catch (err) {
      console.error("Error fetching sessions:", err)
    }
  }

  const scheduleSession = async () => {
    if (!sessionDate || !sessionTime || !selectedCourse) return
    
    try {
      const { error } = await supabase.from('sessions').insert({
        course_id: selectedCourse.id,
        date: sessionDate,
        time: sessionTime,
        link: sessionLink
      })

      if (error) throw error

      alert("Sesión creada correctamente")
      fetchSessions(selectedCourse.id) // Refrescar lista para que todos la vean
      setSessionDate('')
      setSessionTime('')
      setSessionLink('')
      setShowSessionForm(false)
    } catch (err: any) {
      alert("Error al crear sesión: " + err.message)
    }
  }

  // --- 4. CHAT INTELIGENTE (MEJORADO) ---
  
  // Helper para construir el prompt del sistema según categoría
  const getCourseSystemPrompt = (category: CourseCategory, title: string, desc: string) => {
    let specializedPrompt = ""

    if (category === 'math') {
      specializedPrompt = "Eres un profesor de Matemáticas experto. TUS REGLAS: 1. Usa formato LaTeX con doble signo de dólar ($$) para fórmulas complejas y un solo signo ($) para variables inline. 2. Sé muy visual y paso a paso. 3. Si haces una pregunta, SIEMPRE da opciones."
    } else if (category === 'programming') {
      specializedPrompt = "Eres un Senior Developer y mentor. TUS REGLAS: 1. Si pides al estudiante que resuelva un problema, TERMINA tu mensaje con la etiqueta {{CODE_REQUEST}} para activar el editor. 2. Evalúa la lógica, eficiencia y limpieza del código. 3. Si haces preguntas teóricas, da opciones."
    } else if (category === 'letters') {
      specializedPrompt = "Eres un profesor de Literatura y Humanidades. TUS REGLAS: 1. Usa un lenguaje elocuente, bien estructurado y elegante. 2. Prioriza el análisis crítico y el contexto histórico. 3. Formatea tu texto con párrafos claros y negritas para énfasis."
    } else {
      specializedPrompt = "Eres un tutor experto y amable."
    }

    return `
      CONTEXTO DEL CURSO: ${title} - ${desc}
      ROL: ${specializedPrompt}
      
      REGLA DE ORO (BOTONES):
      Siempre que hagas una pregunta de opción múltiple o quieras que el usuario elija un camino, pon las opciones AL FINAL de tu respuesta en este formato exacto:
      {{Opción 1|Opción 2|Opción 3}}
      
      REGLA DE ORO (CÓDIGO):
      Si es un ejercicio de programación donde el estudiante debe escribir código, pon al final: {{CODE_REQUEST}}
    `
  }

  const initAiConversation = async (course: Course) => {
    if (messages.length > 0) return // No reiniciar si ya hay mensajes

    setAiLoading(true)
    const systemInstruction = getCourseSystemPrompt(course.category, course.title, course.description)
    
    const response = await chatWithGemini(
      "Hola, soy el estudiante. Inicia la clase saludando y evaluando mi nivel con una pregunta.", 
      systemInstruction, 
      []
    )
    
    if (response.success) {
      const { text, options, isCodeRequest } = parseAiResponse(response.message)
      setMessages([{ role: 'model', content: text, timestamp: new Date(), options, isCodeRequest }])
      if(isCodeRequest) setCodeEditorVisible(true)
    }
    setAiLoading(false)
  }

  const parseAiResponse = (text: string) => {
    let cleanText = text
    let options: string[] | undefined = undefined
    let isCodeRequest = false

    const optionsMatch = text.match(/\{\{(.+?)\}\}/)
    if (optionsMatch) {
      if (optionsMatch[1].includes('CODE_REQUEST')) {
        isCodeRequest = true
      } else {
        options = optionsMatch[1].split('|')
      }
      cleanText = text.replace(optionsMatch[0], '').trim()
    }
    return { text: cleanText, options, isCodeRequest }
  }

  const handleSendMessage = async (msgOverride?: string) => {
    const finalMsg = msgOverride || inputMsg
    if (!finalMsg.trim() || !selectedCourse) return

    const newMsg = { role: 'user', content: finalMsg, timestamp: new Date() } as Message
    setMessages(prev => [...prev, newMsg])
    setInputMsg('')
    setAiLoading(true)
    setCodeEditorVisible(false) 

    // Reenviamos el System Prompt en cada turno para asegurar que no pierda el contexto
    const systemInstruction = getCourseSystemPrompt(selectedCourse.category, selectedCourse.title, selectedCourse.description)

    const response = await chatWithGemini(finalMsg, systemInstruction, messages)

    if (response.success) {
      const { text, options, isCodeRequest } = parseAiResponse(response.message)
      setMessages(prev => [...prev, { role: 'model', content: text, timestamp: new Date(), options, isCodeRequest }])
      if (isCodeRequest) setCodeEditorVisible(true)
    }
    setAiLoading(false)
  }

  const renderFormattedText = (text: string, category: CourseCategory) => {
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-indigo-600 dark:text-indigo-400 font-bold">{part.slice(2, -2)}</strong>
      }
      // Renderizado mejorado de fórmulas estilo LaTeX
      if (part.includes('$$') || part.includes('$')) {
         return <span key={i} className="font-serif italic bg-yellow-50 dark:bg-yellow-900/30 px-2 py-0.5 rounded text-lg mx-1 border border-yellow-100 dark:border-yellow-900/50">{part}</span>
      }
      return <span key={i} className={category === 'letters' ? 'font-serif leading-relaxed text-lg text-gray-800 dark:text-gray-200' : ''}>{part}</span>
    })
  }

  if (!mounted) return null
  if (loadingProfile || fixingProfile) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><RefreshCw className="animate-spin text-blue-600 w-8 h-8"/></div>

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#020617] transition-colors duration-300 font-sans text-sm md:text-base overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-20 lg:w-72 bg-white dark:bg-[#0f172a] border-r border-gray-200 dark:border-gray-800 flex flex-col z-20 shadow-xl">
        <div className="p-6 flex items-center gap-3 border-b dark:border-gray-800">
          <div className="bg-indigo-600 p-2 rounded-xl text-white"><GraduationCap /></div>
          <span className="font-bold text-xl dark:text-white hidden lg:block">E-Learning</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => {
            setView('courses')
            if (user && profile) fetchCourses(profile.role, user.id)
          }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'courses' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            <BookOpen className="w-5 h-5" /> <span className="hidden lg:block">Mis Cursos</span>
          </button>
          
          <button onClick={() => setView('create')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'create' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            {profile?.role === 'teacher' ? <Plus className="w-5 h-5" /> : <Search className="w-5 h-5" />} 
            <span className="hidden lg:block">{profile?.role === 'teacher' ? 'Crear Curso' : 'Explorar'}</span>
          </button>
        </nav>

        <div className="p-4 border-t dark:border-gray-800">
          <div className="flex items-center gap-3 mb-4 p-2">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
              {profile?.full_name.substring(0,2).toUpperCase()}
            </div>
            <div className="hidden lg:block">
              <p className="font-bold dark:text-white truncate w-32">{profile?.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex justify-center"><Sun className="w-5 h-5 hidden dark:block"/><Moon className="w-5 h-5 block dark:hidden"/></button>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="flex-1 p-2 rounded-lg bg-red-50 text-red-500 flex justify-center"><LogOut className="w-5 h-5"/></button>
          </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* VISTA: LISTA DE CURSOS */}
        {view === 'courses' && (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold dark:text-white">Tu Aprendizaje</h1>
              <button 
                onClick={() => user && profile && fetchCourses(profile.role, user.id)}
                className="flex items-center gap-2 text-sm text-indigo-600 font-bold hover:bg-indigo-50 px-3 py-1 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Actualizar
              </button>
            </div>
            
            {myCourses.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-gray-500 mb-4">No tienes cursos activos.</p>
                <button onClick={() => setView('create')} className="text-indigo-600 font-bold hover:underline">Empieza ahora</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myCourses.map(course => (
                  <div key={course.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all group">
                    <div className={`h-32 p-6 flex flex-col justify-end relative ${
                      course.category === 'math' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                      course.category === 'programming' ? 'bg-gradient-to-r from-slate-700 to-slate-900' :
                      course.category === 'letters' ? 'bg-gradient-to-r from-amber-500 to-orange-600' :
                      'bg-gradient-to-r from-indigo-500 to-purple-600'
                    }`}>
                       <span className="absolute top-4 right-4 bg-white/20 text-white text-xs px-2 py-1 rounded backdrop-blur-sm uppercase font-bold">{course.category}</span>
                       <h3 className="text-white font-bold text-xl">{course.title}</h3>
                       <p className="text-white/80 text-xs">{course.profiles?.full_name}</p>
                    </div>
                    <div className="p-6">
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">{course.description}</p>
                      <button 
                        onClick={() => {
                          setSelectedCourse(course)
                          setView('course_detail')
                          setMessages([])
                          fetchSessions(course.id)
                          if(profile?.role === 'student') initAiConversation(course)
                        }}
                        className="w-full py-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg font-semibold hover:bg-indigo-600 hover:text-white transition-colors"
                      >
                        Ingresar al Aula
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VISTA: DETALLE DEL CURSO (CHAT + ASESORÍAS) */}
        {view === 'course_detail' && selectedCourse && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* AREA DE CHAT (IZQUIERDA / CENTRO) */}
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#0b1120] relative">
               {/* Header del Chat */}
               <div className="h-16 bg-white dark:bg-gray-900 border-b dark:border-gray-800 flex items-center justify-between px-6 shrink-0">
                 <div className="flex items-center gap-3">
                   <button onClick={() => setView('courses')} className="text-gray-400 hover:text-gray-600">← Volver</button>
                   <div>
                     <h2 className="font-bold dark:text-white flex items-center gap-2">
                       {selectedCourse.title}
                       <span className={`w-2 h-2 rounded-full ${aiLoading ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}`}></span>
                     </h2>
                     <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">{selectedCourse.category}</p>
                   </div>
                 </div>
               </div>

               {/* Mensajes */}
               <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {messages.map((msg, i) => (
                   <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-3xl mx-auto w-full animate-in slide-in-from-bottom-2`}>
                     <div className={`flex gap-3 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-green-600'}`}>
                         {msg.role === 'user' ? <User className="text-white w-4 h-4"/> : <Bot className="text-white w-4 h-4"/>}
                       </div>
                       
                       <div className="flex flex-col gap-2 w-full">
                         {/* Burbuja de Texto */}
                         <div className={`p-4 rounded-2xl shadow-sm ${
                           msg.role === 'user' 
                             ? 'bg-indigo-600 text-white rounded-tr-none' 
                             : 'bg-white dark:bg-gray-800 dark:text-gray-100 rounded-tl-none border dark:border-gray-700'
                         }`}>
                           <div className="text-sm leading-relaxed whitespace-pre-wrap">
                             {msg.role === 'model' ? renderFormattedText(msg.content, selectedCourse.category) : msg.content}
                           </div>
                         </div>

                         {/* OPCIONES (BOTONES DEBAJO) */}
                         {msg.options && (
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                             {msg.options.map((opt, idx) => (
                               <button 
                                 key={idx} 
                                 onClick={() => handleSendMessage(opt)}
                                 className="bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-indigo-900/30 p-3 rounded-xl text-left text-sm hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center gap-2 group"
                               >
                                 <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">{String.fromCharCode(65 + idx)}</span>
                                 <span className="dark:text-gray-300">{opt}</span>
                               </button>
                             ))}
                           </div>
                         )}

                         {/* EDITOR DE CÓDIGO (SI APLICA) */}
                         {msg.isCodeRequest && (
                           <div className="w-full bg-[#1e1e1e] rounded-xl overflow-hidden shadow-lg border border-gray-700 mt-2">
                             <div className="bg-[#2d2d2d] px-4 py-2 flex items-center gap-2 text-gray-400 text-xs">
                               <CodeIcon className="w-3 h-3" /> Editor de Solución
                             </div>
                             <textarea 
                               disabled={!codeEditorVisible && i !== messages.length - 1}
                               className="w-full bg-transparent text-green-400 font-mono text-sm p-4 h-48 outline-none resize-none"
                               placeholder="// Escribe tu código aquí..."
                               value={inputMsg}
                               onChange={(e) => setInputMsg(e.target.value)}
                             />
                             {codeEditorVisible && i === messages.length - 1 && (
                               <div className="p-2 bg-[#2d2d2d] flex justify-end">
                                 <button onClick={() => handleSendMessage()} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
                                   <Play className="w-3 h-3" /> Ejecutar y Enviar
                                 </button>
                               </div>
                             )}
                           </div>
                         )}
                       </div>
                     </div>
                   </div>
                 ))}
                 <div ref={chatEndRef} />
               </div>

               {/* Input Area (Solo si no hay editor de código activo) */}
               {!codeEditorVisible && (
                 <div className="p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 max-w-3xl mx-auto w-full">
                   <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-full border dark:border-gray-700 focus-within:ring-2 focus-within:ring-indigo-500">
                     <input 
                       className="flex-1 bg-transparent px-4 py-2 outline-none dark:text-white"
                       placeholder="Escribe tu duda..."
                       value={inputMsg}
                       onChange={e => setInputMsg(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                       disabled={aiLoading}
                     />
                     <button onClick={() => handleSendMessage()} disabled={!inputMsg.trim()} className="p-2 bg-indigo-600 rounded-full text-white hover:bg-indigo-700 disabled:opacity-50"><Send className="w-4 h-4"/></button>
                   </div>
                 </div>
               )}
            </div>

            {/* PANEL DERECHO: ASESORÍAS (DENTRO DEL CURSO) */}
            <div className="w-full md:w-80 bg-white dark:bg-[#0f172a] border-l dark:border-gray-800 overflow-y-auto p-6 shrink-0">
               <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center gap-2">
                 <Video className="w-5 h-5 text-purple-500" /> Asesorías
               </h3>
               
               {/* Lista de Sesiones */}
               <div className="space-y-3 mb-6">
                 {courseSessions.length === 0 ? (
                   <p className="text-sm text-gray-400 text-center py-4">No hay sesiones programadas.</p>
                 ) : (
                   courseSessions.map((session, idx) => (
                     <div key={idx} className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 p-3 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors">
                       <p className="font-bold text-purple-700 dark:text-purple-300 text-sm">{session.date} - {session.time}</p>
                       <a href={session.link} target="_blank" className="text-xs text-purple-600 dark:text-purple-400 underline mt-1 flex items-center gap-1 hover:text-purple-800">
                         Unirse a la reunión <ExternalLink className="w-3 h-3"/>
                       </a>
                     </div>
                   ))
                 )}
               </div>

               {/* Formulario Crear Sesión (Solo Docente) */}
               {profile?.role === 'teacher' && selectedCourse.created_by === user?.id && (
                 <div className="border-t dark:border-gray-800 pt-4">
                   <button 
                     onClick={() => setShowSessionForm(!showSessionForm)}
                     className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 text-sm font-semibold hover:border-purple-500 hover:text-purple-500 transition-colors flex items-center justify-center gap-2"
                   >
                     <Plus className="w-4 h-4" /> Nueva Asesoría
                   </button>
                   
                   {showSessionForm && (
                     <div className="mt-4 space-y-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl animate-in slide-in-from-top-2">
                       <input type="date" className="w-full p-2 rounded-lg border text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white outline-none focus:border-purple-500" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
                       <input type="time" className="w-full p-2 rounded-lg border text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white outline-none focus:border-purple-500" value={sessionTime} onChange={e => setSessionTime(e.target.value)} />
                       <input type="url" placeholder="Link (Zoom/Meet)" className="w-full p-2 rounded-lg border text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white outline-none focus:border-purple-500" value={sessionLink} onChange={e => setSessionLink(e.target.value)} />
                       <button onClick={scheduleSession} className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors">Guardar Sesión</button>
                     </div>
                   )}
                 </div>
               )}
            </div>
          </div>
        )}

        {/* VISTA: CREAR CURSO */}
        {view === 'create' && (
          <div className="flex-1 overflow-y-auto p-8 flex justify-center">
             <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 h-fit">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-2xl font-bold dark:text-white">{profile?.role === 'teacher' ? 'Crear Nuevo Curso' : 'Explorar Cursos'}</h2>
                 <button onClick={() => setView('courses')} className="text-gray-400 hover:text-gray-600">Cancelar</button>
               </div>

               {profile?.role === 'teacher' ? (
                 <div className="space-y-5">
                   <div>
                     <label className="block text-sm font-bold mb-2 dark:text-gray-300">Título</label>
                     <input className="w-full p-3 border rounded-xl dark:bg-gray-900 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ej: Cálculo I" value={newCourseTitle} onChange={e => setNewCourseTitle(e.target.value)} />
                   </div>
                   
                   <div className="grid grid-cols-3 gap-3">
                     <button onClick={() => setNewCourseCategory('math')} className={`p-3 rounded-xl border text-center text-sm font-bold transition-all ${newCourseCategory === 'math' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300'}`}>📐 Matemáticas</button>
                     <button onClick={() => setNewCourseCategory('letters')} className={`p-3 rounded-xl border text-center text-sm font-bold transition-all ${newCourseCategory === 'letters' ? 'bg-amber-100 border-amber-500 text-amber-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300'}`}>📚 Letras</button>
                     <button onClick={() => setNewCourseCategory('programming')} className={`p-3 rounded-xl border text-center text-sm font-bold transition-all ${newCourseCategory === 'programming' ? 'bg-slate-200 border-slate-600 text-slate-800' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300'}`}>💻 Programación</button>
                   </div>

                   <div>
                     <label className="block text-sm font-bold mb-2 dark:text-gray-300">Descripción</label>
                     <textarea className="w-full p-3 border rounded-xl h-32 dark:bg-gray-900 dark:border-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="¿De qué trata el curso?" value={newCourseDesc} onChange={e => setNewCourseDesc(e.target.value)} />
                   </div>
                   <button onClick={createCourse} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30">Publicar Curso</button>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {courses.map(c => (
                     <div key={c.id} className="border dark:border-gray-700 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                       <div className="flex justify-between">
                         <h3 className="font-bold dark:text-white">{c.title}</h3>
                         <span className="text-xs uppercase bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded font-bold">{c.category}</span>
                       </div>
                       <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-4 line-clamp-2">{c.description}</p>
                       {myCourses.some(mc => mc.id === c.id) ? (
                         <button disabled className="w-full py-2 bg-green-100 text-green-700 rounded-lg text-sm font-bold">Inscrito</button>
                       ) : (
                         <button onClick={() => enrollCourse(c.id)} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Inscribirse</button>
                       )}
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        )}

      </main>
    </div>
  )
}