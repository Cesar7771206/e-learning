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
  CheckCircle2, Play, Video, ExternalLink, Trash2, Edit, XCircle
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
  id?: string,
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
  const [view, setView] = useState<'courses' | 'course_detail' | 'create' | 'edit'>('courses')
  
  // Datos
  const [courses, setCourses] = useState<Course[]>([])
  const [myCourses, setMyCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [courseSessions, setCourseSessions] = useState<Session[]>([])
  
  // Formularios Curso
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [newCourseDesc, setNewCourseDesc] = useState('')
  const [newCourseCategory, setNewCourseCategory] = useState<CourseCategory>('other')
  // Estado extra para edición
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null)

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

  // --- 2. GESTIÓN DE CURSOS ---
  const fetchCourses = async (role: string | undefined, userId: string) => {
    try {
      if (role === 'teacher') {
        let { data } = await supabase.from('courses').select('*, profiles(full_name)').eq('created_by', userId)
        if (!data) { // Fallback
           const simple = await supabase.from('courses').select('*').eq('created_by', userId)
           data = simple.data
        }
        setMyCourses(data || [])
      } else {
        // Estudiante
        let { data: enrollData } = await supabase.from('enrollments').select('course_id, courses(*, profiles(full_name))').eq('student_id', userId)
        if (!enrollData) { // Fallback
            const simpleEnroll = await supabase.from('enrollments').select('course_id, courses(*)')
            .eq('student_id', userId)
            enrollData = simpleEnroll.data
        }
        const enrolled = enrollData?.map((e: any) => e.courses).filter(Boolean) || []
        setMyCourses(enrolled)
        
        // Explorar
        let { data: allData } = await supabase.from('courses').select('*, profiles(full_name)')
        if (!allData) {
            const simpleAll = await supabase.from('courses').select('*')
            allData = simpleAll.data
        }
        setCourses(allData || [])
      }
    } catch (err) { console.error(err) }
  }

  // --- ACCIONES DOCENTE (CREAR, EDITAR, ELIMINAR) ---
  const createOrUpdateCourse = async () => {
    if (!profile || profile.role !== 'teacher') return
    try {
      if (editingCourseId) {
        // ACTUALIZAR
        const { error } = await supabase.from('courses').update({
          title: newCourseTitle,
          description: newCourseDesc,
          category: newCourseCategory,
        }).eq('id', editingCourseId)
        if (error) throw error
        alert("Curso actualizado")
      } else {
        // CREAR
        const { error } = await supabase.from('courses').insert({
          title: newCourseTitle,
          description: newCourseDesc,
          category: newCourseCategory,
          created_by: user.id
        })
        if (error) throw error
        alert("Curso creado exitosamente")
      }
      
      setNewCourseTitle('')
      setNewCourseDesc('')
      setEditingCourseId(null)
      setTimeout(() => {
        fetchCourses('teacher', user.id)
        setView('courses')
      }, 500)
    } catch (error: any) { alert(error.message) }
  }

  const deleteCourse = async (courseId: number) => {
    if (!confirm("¿Estás seguro de eliminar este curso? Se borrarán todos los chats y sesiones asociados.")) return
    const { error } = await supabase.from('courses').delete().eq('id', courseId)
    if (error) alert("Error al eliminar")
    else fetchCourses('teacher', user.id)
  }

  const startEditing = (course: Course) => {
    setNewCourseTitle(course.title)
    setNewCourseDesc(course.description)
    setNewCourseCategory(course.category)
    setEditingCourseId(course.id)
    setView('create') // Reutilizamos la vista de crear
  }

  // --- ACCIONES ESTUDIANTE (INSCRIBIRSE, SALIRSE) ---
  const enrollCourse = async (courseId: number) => {
    const { error } = await supabase.from('enrollments').insert({ student_id: user.id, course_id: courseId })
    if (!error) {
      fetchCourses('student', user.id)
      alert("¡Inscrito correctamente!")
    }
  }

  const leaveCourse = async (courseId: number) => {
    if (!confirm("¿Deseas salirte de este curso?")) return
    const { error } = await supabase.from('enrollments').delete().eq('student_id', user.id).eq('course_id', courseId)
    if (!error) {
      fetchCourses('student', user.id)
      alert("Te has salido del curso.")
    }
  }

  // --- 3. GESTIÓN DE SESIONES ---
  const fetchSessions = async (courseId: number) => {
    const { data } = await supabase.from('sessions').select('*').eq('course_id', courseId).order('date', { ascending: true })
    setCourseSessions(data || [])
  }

  const scheduleSession = async () => {
    if (!sessionDate || !sessionTime || !selectedCourse) return
    const { error } = await supabase.from('sessions').insert({
      course_id: selectedCourse.id,
      date: sessionDate,
      time: sessionTime,
      link: sessionLink
    })
    if (!error) {
      alert("Sesión creada")
      fetchSessions(selectedCourse.id)
      setShowSessionForm(false)
    }
  }

  // --- 4. CHAT INTELIGENTE (CON PERSISTENCIA) ---
  
  // Cargar historial
  const fetchChatHistory = async (courseId: number) => {
    if (!user) return
    setAiLoading(true)
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    
    if (data && data.length > 0) {
      // Mapear de DB a formato local
      const mappedMessages: Message[] = data.map(m => ({
        role: m.role as 'user' | 'model',
        content: m.content,
        options: m.options ? JSON.parse(m.options as any) : undefined, // Asumiendo que guardamos como JSON string o array
        isCodeRequest: m.is_code_request,
        timestamp: new Date(m.created_at)
      }))
      setMessages(mappedMessages)
      setAiLoading(false)
    } else {
      setMessages([])
      setAiLoading(false)
      // Si no hay historial, iniciar conversación
      initAiConversation(selectedCourse!)
    }
  }

  // Guardar mensaje en DB
  const saveMessageToDb = async (msg: Message, courseId: number) => {
     await supabase.from('chat_messages').insert({
       user_id: user.id,
       course_id: courseId,
       role: msg.role,
       content: msg.content,
       options: msg.options ? JSON.stringify(msg.options) : null, // Guardar array como string si es necesario o usar array de postgres
       is_code_request: msg.isCodeRequest || false
     })
  }

  const getCourseSystemPrompt = (category: CourseCategory, title: string, desc: string) => {
    let specializedPrompt = ""
    if (category === 'math') specializedPrompt = "Eres un profesor de Matemáticas. Usa formato LaTeX ($$). Sé visual."
    else if (category === 'programming') specializedPrompt = "Eres un Senior Developer. Si pides código, termina con {{CODE_REQUEST}}."
    else if (category === 'letters') specializedPrompt = "Eres un profesor de Literatura. Lenguaje elegante y crítico."
    else specializedPrompt = "Eres un tutor experto."

    return `CONTEXTO: ${title}. ${specializedPrompt}. REGLA: Si hay opciones, usa {{Opción 1|Opción 2}}. Si es código, {{CODE_REQUEST}}.`
  }

  const initAiConversation = async (course: Course) => {
    // Solo inicia si realmente no hay mensajes (doble chequeo)
    setAiLoading(true)
    const systemInstruction = getCourseSystemPrompt(course.category, course.title, course.description)
    
    const response = await chatWithGemini("Hola, soy el estudiante. Inicia la clase.", systemInstruction, [])
    
    if (response.success) {
      const { text, options, isCodeRequest } = parseAiResponse(response.message)
      const newMsg: Message = { role: 'model', content: text, timestamp: new Date(), options, isCodeRequest }
      
      setMessages([newMsg])
      saveMessageToDb(newMsg, course.id)
      
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

    const userMsg: Message = { role: 'user', content: finalMsg, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInputMsg('')
    setAiLoading(true)
    setCodeEditorVisible(false) 
    
    // Guardar mensaje del usuario
    saveMessageToDb(userMsg, selectedCourse.id)

    const systemInstruction = getCourseSystemPrompt(selectedCourse.category, selectedCourse.title, selectedCourse.description)
    const response = await chatWithGemini(finalMsg, systemInstruction, messages)

    if (response.success) {
      const { text, options, isCodeRequest } = parseAiResponse(response.message)
      const aiMsg: Message = { role: 'model', content: text, timestamp: new Date(), options, isCodeRequest }
      
      setMessages(prev => [...prev, aiMsg])
      saveMessageToDb(aiMsg, selectedCourse.id) // Guardar respuesta IA

      if (isCodeRequest) setCodeEditorVisible(true)
    }
    setAiLoading(false)
  }

  const renderFormattedText = (text: string, category: CourseCategory) => {
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="text-indigo-600 dark:text-indigo-400 font-bold">{part.slice(2, -2)}</strong>
      if (part.includes('$$') || part.includes('$')) return <span key={i} className="font-serif italic bg-yellow-50 dark:bg-yellow-900/30 px-2 rounded mx-1">{part}</span>
      return <span key={i} className={category === 'letters' ? 'font-serif text-lg' : ''}>{part}</span>
    })
  }

  // --- RENDER ---
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
          <button onClick={() => { setView('courses'); if (user && profile) fetchCourses(profile.role, user.id); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'courses' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            <BookOpen className="w-5 h-5" /> <span className="hidden lg:block">Mis Cursos</span>
          </button>
          
          <button onClick={() => { setView('create'); setEditingCourseId(null); setNewCourseTitle(''); setNewCourseDesc(''); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'create' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            {profile?.role === 'teacher' ? <Plus className="w-5 h-5" /> : <Search className="w-5 h-5" />} 
            <span className="hidden lg:block">{profile?.role === 'teacher' ? 'Crear Curso' : 'Explorar'}</span>
          </button>
        </nav>

        <div className="p-4 border-t dark:border-gray-800">
          <div className="flex items-center gap-3 mb-4 p-2">
             <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">{profile?.full_name.substring(0,2).toUpperCase()}</div>
             <div className="hidden lg:block"><p className="font-bold dark:text-white truncate w-32">{profile?.full_name}</p><p className="text-xs text-gray-500 capitalize">{profile?.role}</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 flex justify-center"><Sun className="w-5 h-5 hidden dark:block"/><Moon className="w-5 h-5 block dark:hidden"/></button>
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
              <button onClick={() => user && profile && fetchCourses(profile.role, user.id)} className="flex items-center gap-2 text-sm text-indigo-600 font-bold hover:bg-indigo-50 px-3 py-1 rounded-lg transition-colors"><RefreshCw className="w-4 h-4" /> Actualizar</button>
            </div>
            
            {myCourses.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-gray-500 mb-4">No tienes cursos activos.</p>
                <button onClick={() => setView('create')} className="text-indigo-600 font-bold hover:underline">Empieza ahora</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myCourses.map(course => (
                  <div key={course.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all relative group">
                    <div className={`h-32 p-6 flex flex-col justify-end relative ${
                      course.category === 'math' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                      course.category === 'programming' ? 'bg-gradient-to-r from-slate-700 to-slate-900' :
                      'bg-gradient-to-r from-indigo-500 to-purple-600'
                    }`}>
                       <span className="absolute top-4 right-4 bg-white/20 text-white text-xs px-2 py-1 rounded backdrop-blur-sm uppercase font-bold">{course.category}</span>
                       <h3 className="text-white font-bold text-xl">{course.title}</h3>
                       <p className="text-white/80 text-xs">{course.profiles?.full_name}</p>
                    </div>
                    
                    <div className="p-6">
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">{course.description}</p>
                      
                      <div className="flex gap-2">
                        {profile?.role === 'teacher' ? (
                          <>
                            <button 
                              onClick={() => { setSelectedCourse(course); setView('course_detail'); fetchSessions(course.id); }}
                              className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600"
                            >
                              Administrar
                            </button>
                            <button onClick={() => startEditing(course)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Editar"><Edit className="w-5 h-5"/></button>
                            <button onClick={() => deleteCourse(course.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Eliminar"><Trash2 className="w-5 h-5"/></button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => {
                                setSelectedCourse(course)
                                setView('course_detail')
                                setMessages([])
                                fetchSessions(course.id)
                                fetchChatHistory(course.id) // CARGAR HISTORIAL AL ENTRAR
                              }}
                              className="flex-1 py-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg font-semibold hover:bg-indigo-600 hover:text-white transition-colors"
                            >
                              Ingresar al Aula
                            </button>
                            <button onClick={() => leaveCourse(course.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Salir del curso"><LogOut className="w-5 h-5"/></button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VISTA: DETALLE DEL CURSO */}
        {view === 'course_detail' && selectedCourse && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* ZONA PRINCIPAL (CHAT ESTUDIANTE / PANEL DOCENTE) */}
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#0b1120] relative">
               <div className="h-16 bg-white dark:bg-gray-900 border-b dark:border-gray-800 flex items-center justify-between px-6 shrink-0">
                 <div className="flex items-center gap-3">
                   <button onClick={() => setView('courses')} className="text-gray-400 hover:text-gray-600">← Volver</button>
                   <div>
                     <h2 className="font-bold dark:text-white flex items-center gap-2">{selectedCourse.title}</h2>
                     <p className="text-xs text-gray-500 uppercase font-semibold">{profile?.role === 'teacher' ? 'Panel de Administración' : 'Aula Virtual'}</p>
                   </div>
                 </div>
               </div>

               {/* LOGICA DE VISTA SEGUN ROL */}
               {profile?.role === 'student' ? (
                 <>
                   {/* CHAT DEL ESTUDIANTE */}
                   <div className="flex-1 overflow-y-auto p-6 space-y-6">
                     {messages.map((msg, i) => (
                       <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-3xl mx-auto w-full animate-in slide-in-from-bottom-2`}>
                         <div className={`flex gap-3 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-green-600'}`}>{msg.role === 'user' ? <User className="text-white w-4 h-4"/> : <Bot className="text-white w-4 h-4"/>}</div>
                           <div className="flex flex-col gap-2 w-full">
                             <div className={`p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 dark:text-gray-100 rounded-tl-none border dark:border-gray-700'}`}>
                               <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.role === 'model' ? renderFormattedText(msg.content, selectedCourse.category) : msg.content}</div>
                             </div>
                             {msg.options && (
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                 {msg.options.map((opt, idx) => (
                                   <button key={idx} onClick={() => handleSendMessage(opt)} className="bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-indigo-900/30 p-3 rounded-xl text-left text-sm hover:border-indigo-500 transition-all flex items-center gap-2 group">
                                     <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{String.fromCharCode(65 + idx)}</span><span className="dark:text-gray-300">{opt}</span>
                                   </button>
                                 ))}
                               </div>
                             )}
                             {msg.isCodeRequest && (
                               <div className="w-full bg-[#1e1e1e] rounded-xl overflow-hidden shadow-lg border border-gray-700 mt-2">
                                 <div className="bg-[#2d2d2d] px-4 py-2 flex items-center gap-2 text-gray-400 text-xs"><CodeIcon className="w-3 h-3" /> Editor</div>
                                 <textarea disabled={!codeEditorVisible && i !== messages.length - 1} className="w-full bg-transparent text-green-400 font-mono text-sm p-4 h-48 outline-none resize-none" placeholder="// Escribe código..." value={inputMsg} onChange={(e) => setInputMsg(e.target.value)}/>
                                 {codeEditorVisible && i === messages.length - 1 && (<div className="p-2 bg-[#2d2d2d] flex justify-end"><button onClick={() => handleSendMessage()} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2"><Play className="w-3 h-3" /> Ejecutar</button></div>)}
                               </div>
                             )}
                           </div>
                         </div>
                       </div>
                     ))}
                     <div ref={chatEndRef} />
                   </div>
                   {!codeEditorVisible && (
                     <div className="p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 max-w-3xl mx-auto w-full">
                       <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-full border dark:border-gray-700 focus-within:ring-2 focus-within:ring-indigo-500">
                         <input className="flex-1 bg-transparent px-4 py-2 outline-none dark:text-white" placeholder="Escribe tu duda..." value={inputMsg} onChange={e => setInputMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} disabled={aiLoading}/>
                         <button onClick={() => handleSendMessage()} disabled={!inputMsg.trim()} className="p-2 bg-indigo-600 rounded-full text-white hover:bg-indigo-700 disabled:opacity-50"><Send className="w-4 h-4"/></button>
                       </div>
                     </div>
                   )}
                 </>
               ) : (
                 // VISTA DEL DOCENTE (NO CHAT)
                 <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                   <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-full mb-4"><Wrench className="w-12 h-12 text-gray-500" /></div>
                   <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">Modo Administración</h3>
                   <p className="max-w-md mt-2">Como docente, puedes gestionar las sesiones a la derecha, o editar el contenido del curso desde el menú principal.</p>
                 </div>
               )}
            </div>

            {/* PANEL DERECHO: ASESORÍAS */}
            <div className="w-full md:w-80 bg-white dark:bg-[#0f172a] border-l dark:border-gray-800 overflow-y-auto p-6 shrink-0">
               <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center gap-2"><Video className="w-5 h-5 text-purple-500" /> Asesorías</h3>
               <div className="space-y-3 mb-6">
                 {courseSessions.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No hay sesiones.</p> : courseSessions.map((session, idx) => (
                   <div key={idx} className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 p-3 rounded-xl hover:bg-purple-100 transition-colors">
                     <p className="font-bold text-purple-700 dark:text-purple-300 text-sm">{session.date} - {session.time}</p>
                     <a href={session.link} target="_blank" className="text-xs text-purple-600 underline mt-1 flex items-center gap-1">Unirse <ExternalLink className="w-3 h-3"/></a>
                   </div>
                 ))}
               </div>
               {profile?.role === 'teacher' && selectedCourse.created_by === user?.id && (
                 <div className="border-t dark:border-gray-800 pt-4">
                   <button onClick={() => setShowSessionForm(!showSessionForm)} className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 text-sm font-semibold hover:border-purple-500 hover:text-purple-500 transition-colors flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Nueva Asesoría</button>
                   {showSessionForm && (
                     <div className="mt-4 space-y-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl animate-in slide-in-from-top-2">
                       <input type="date" className="w-full p-2 rounded-lg border text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
                       <input type="time" className="w-full p-2 rounded-lg border text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white" value={sessionTime} onChange={e => setSessionTime(e.target.value)} />
                       <input type="url" placeholder="Link" className="w-full p-2 rounded-lg border text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white" value={sessionLink} onChange={e => setSessionLink(e.target.value)} />
                       <button onClick={scheduleSession} className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-purple-700">Guardar</button>
                     </div>
                   )}
                 </div>
               )}
            </div>
          </div>
        )}

        {/* VISTA: CREAR / EDITAR CURSO */}
        {view === 'create' && (
          <div className="flex-1 overflow-y-auto p-8 flex justify-center">
             <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 h-fit">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-2xl font-bold dark:text-white">{profile?.role === 'teacher' ? (editingCourseId ? 'Editar Curso' : 'Crear Nuevo Curso') : 'Explorar Cursos'}</h2>
                 <button onClick={() => setView('courses')} className="text-gray-400 hover:text-gray-600">Cancelar</button>
               </div>
               {profile?.role === 'teacher' ? (
                 <div className="space-y-5">
                   <div><label className="block text-sm font-bold mb-2 dark:text-gray-300">Título</label><input className="w-full p-3 border rounded-xl dark:bg-gray-900 dark:border-gray-700 dark:text-white" placeholder="Ej: Cálculo I" value={newCourseTitle} onChange={e => setNewCourseTitle(e.target.value)} /></div>
                   <div className="grid grid-cols-3 gap-3">
                     <button onClick={() => setNewCourseCategory('math')} className={`p-3 rounded-xl border text-center text-sm font-bold transition-all ${newCourseCategory === 'math' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300'}`}>📐 Mate</button>
                     <button onClick={() => setNewCourseCategory('letters')} className={`p-3 rounded-xl border text-center text-sm font-bold transition-all ${newCourseCategory === 'letters' ? 'bg-amber-100 border-amber-500 text-amber-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300'}`}>📚 Letras</button>
                     <button onClick={() => setNewCourseCategory('programming')} className={`p-3 rounded-xl border text-center text-sm font-bold transition-all ${newCourseCategory === 'programming' ? 'bg-slate-200 border-slate-600 text-slate-800' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-700 dark:text-gray-300'}`}>💻 Code</button>
                   </div>
                   <div><label className="block text-sm font-bold mb-2 dark:text-gray-300">Descripción</label><textarea className="w-full p-3 border rounded-xl h-32 dark:bg-gray-900 dark:border-gray-700 dark:text-white" placeholder="Detalles..." value={newCourseDesc} onChange={e => setNewCourseDesc(e.target.value)} /></div>
                   <button onClick={createOrUpdateCourse} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/30">{editingCourseId ? 'Guardar Cambios' : 'Publicar Curso'}</button>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {courses.map(c => (
                     <div key={c.id} className="border dark:border-gray-700 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                       <div className="flex justify-between"><h3 className="font-bold dark:text-white">{c.title}</h3><span className="text-xs uppercase bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded font-bold">{c.category}</span></div>
                       <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-4 line-clamp-2">{c.description}</p>
                       {myCourses.some(mc => mc.id === c.id) ? <button disabled className="w-full py-2 bg-green-100 text-green-700 rounded-lg text-sm font-bold">Inscrito</button> : <button onClick={() => enrollCourse(c.id)} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Inscribirse</button>}
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