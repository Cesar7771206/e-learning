'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { chatWithGemini } from '../actions'
import { 
  LogOut, Plus, Book, User, Send, Bot, 
  GraduationCap, Sun, Moon, Search, RefreshCw, 
  Calendar as CalendarIcon, Lightbulb, Code as CodeIcon,
  Play, Video, ExternalLink, Trash2, Edit, Users, ListChecks, ArrowLeft
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
  syllabus?: string,
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

// Utilidad para resaltar código simple
const highlightCode = (code: string) => {
  if (!code) return '';
  return code
    .replace(/</g, '&lt;').replace(/>/g, '&gt;') // Escapar HTML
    .replace(/\b(function|const|let|var|if|else|return|import|from|class|export|async|await|def|for|while)\b/g, '<span class="text-purple-400 font-bold">$1</span>')
    .replace(/\b(console|log|map|filter|reduce|push|print)\b/g, '<span class="text-blue-400">$1</span>')
    .replace(/('.*?'|".*?")/g, '<span class="text-green-400">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="text-orange-400">$1</span>')
    .replace(/(\/\/.*)/g, '<span class="text-gray-500 italic">$1</span>');
}

export default function Dashboard() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Estados Globales
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  
  // Vistas y Datos
  const [view, setView] = useState<'courses' | 'course_detail' | 'create'>('courses')
  const [courses, setCourses] = useState<Course[]>([])
  const [myCourses, setMyCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [courseSessions, setCourseSessions] = useState<Session[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<Profile[]>([]) 
  
  // Formularios
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [newCourseDesc, setNewCourseDesc] = useState('')
  const [newCourseCategory, setNewCourseCategory] = useState<CourseCategory>('other')
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null)
  const [syllabusInput, setSyllabusInput] = useState('')

  // Chat y Editor
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [codeEditorVisible, setCodeEditorVisible] = useState(false)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionData, setSessionData] = useState({ date: '', time: '', link: '' })
  
  const chatEndRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  // --- 1. CARGA INICIAL ROBUSTA ---
  const fetchProfile = useCallback(async (currentUser: any) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle()
      
      if (!data || error) {
        // Autocuración: Si falla, creamos perfil por defecto y recargamos
        console.log("Perfil no encontrado, creando uno nuevo...");
        await supabase.from('profiles').upsert({
          id: currentUser.id, 
          full_name: currentUser.email?.split('@')[0] || 'Usuario', 
          role: 'student'
        })
        window.location.reload()
        return
      }
      setProfile(data)
      setLoadingProfile(false)
      fetchCourses(data.role, currentUser.id)
    } catch (err) { 
      console.error("Error crítico login:", err); 
      setLoadingProfile(false) 
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) router.push('/')
      else { setUser(data.user); fetchProfile(data.user); }
    }
    init()
  }, [router, fetchProfile])

  // --- 2. GESTIÓN DE DATOS ---
  const fetchCourses = async (role: string | undefined, userId: string) => {
    try {
      if (role === 'teacher') {
        const { data } = await supabase.from('courses').select('*, profiles(full_name)').eq('created_by', userId)
        setMyCourses(data || [])
      } else {
        // Estudiante
        const { data: enrollData } = await supabase.from('enrollments').select('course_id, courses(*, profiles(full_name))').eq('student_id', userId)
        setMyCourses(enrollData?.map((e: any) => e.courses).filter(Boolean) || [])
        
        const { data: allData } = await supabase.from('courses').select('*, profiles(full_name)')
        setCourses(allData || [])
      }
    } catch (e) { console.error(e) }
  }

  const fetchEnrolledStudents = async (courseId: number) => {
    const { data } = await supabase.from('enrollments').select('student_id, profiles(*)').eq('course_id', courseId)
    setEnrolledStudents(data?.map((e: any) => e.profiles).filter(Boolean) || [])
  }

  const fetchSessions = async (courseId: number) => {
    const { data } = await supabase.from('sessions').select('*').eq('course_id', courseId).order('date', { ascending: true })
    setCourseSessions(data || [])
  }

  // --- 3. CHAT E HISTORIAL ---
  const fetchChatHistory = async (courseId: number) => {
    if (!user) return
    setAiLoading(true)
    const { data } = await supabase.from('chat_messages').select('*').eq('course_id', courseId).eq('user_id', user.id).order('created_at', { ascending: true })
    
    if (data && data.length > 0) {
      setMessages(data.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'model',
        content: m.content,
        timestamp: new Date(m.created_at),
        options: m.options ? JSON.parse(m.options) : undefined,
        isCodeRequest: m.is_code_request
      })))
      // Si el último mensaje pedía código, mostrar editor
      if (data[data.length - 1].is_code_request) setCodeEditorVisible(true)
    } else {
      setMessages([])
      initAiConversation(selectedCourse!)
    }
    setAiLoading(false)
  }

  const initAiConversation = async (course: Course) => {
    const sysPrompt = getSystemPrompt(course)
    const res = await chatWithGemini("Hola, soy el estudiante. Inicia la clase saludando.", sysPrompt, [])
    if (res.success) processAiResponse(res.message, course.id)
  }

  const handleSendMessage = async (msgOverride?: string) => {
    const txt = msgOverride || inputMsg
    if (!txt.trim() || !selectedCourse) return

    // 1. Guardar mensaje usuario
    const userMsg: Message = { role: 'user', content: txt, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInputMsg('')
    setAiLoading(true)
    setCodeEditorVisible(false) // Ocultar editor mientras piensa

    await supabase.from('chat_messages').insert({ user_id: user.id, course_id: selectedCourse.id, role: 'user', content: txt })

    // 2. Llamar IA
    const sysPrompt = getSystemPrompt(selectedCourse)
    const res = await chatWithGemini(txt, sysPrompt, messages)
    
    if (res.success) processAiResponse(res.message, selectedCourse.id)
    setAiLoading(false)
  }

  const processAiResponse = async (textRaw: string, courseId: number) => {
    const { text, options, isCodeRequest } = parseAiResponse(textRaw)
    const aiMsg: Message = { role: 'model', content: text, timestamp: new Date(), options, isCodeRequest }
    
    setMessages(prev => [...prev, aiMsg])
    await supabase.from('chat_messages').insert({ 
      user_id: user.id, course_id: courseId, role: 'model', content: text, 
      options: options ? JSON.stringify(options) : null, is_code_request: isCodeRequest 
    })

    if (isCodeRequest) setCodeEditorVisible(true)
  }

  const getSystemPrompt = (course: Course) => {
    const syllabus = course.syllabus ? `SÍLABO A SEGUIR:\n${course.syllabus}` : "Define los temas clave."
    let role = "Tutor."
    if (course.category === 'math') role = "Profesor de Matemáticas. Usa LaTeX ($$) para fórmulas. Sé visual."
    if (course.category === 'programming') role = "Senior Dev. Si pides código al estudiante, termina con {{CODE_REQUEST}}. Evalúa sintaxis."
    if (course.category === 'letters') role = "Profesor de Literatura. Lenguaje elegante, sin símbolos markdown raros."
    
    return `CONTEXTO: ${course.title}. ${syllabus}. ROL: ${role}. REGLAS: 1. Si preguntas, usa {{Opción A|Opción B}}. 2. Si pides código, {{CODE_REQUEST}}. 3. Respuestas limpias.`
  }

  const parseAiResponse = (text: string) => {
    let cleanText = text
    let options: string[] | undefined = undefined
    let isCodeRequest = false
    const match = text.match(/\{\{(.+?)\}\}/)
    if (match) {
      if (match[1].includes('CODE_REQUEST')) isCodeRequest = true
      else options = match[1].split('|')
      cleanText = text.replace(match[0], '').trim()
    }
    return { text: cleanText, options, isCodeRequest }
  }

  // --- 4. ACCIONES GENERALES ---
  const generateSyllabus = async () => {
    if (!selectedCourse) return
    alert("Generando sílabo...")
    const res = await chatWithGemini(`Crea un sílabo de 5 temas para ${selectedCourse.title}`, "Experto", [])
    if (res.success) setSyllabusInput(res.message)
  }

  const saveSyllabus = async () => {
    if (!selectedCourse) return
    const { error } = await supabase.from('courses').update({ syllabus: syllabusInput }).eq('id', selectedCourse.id)
    if (!error) { alert("Sílabo guardado"); setSelectedCourse({ ...selectedCourse, syllabus: syllabusInput }); }
  }

  const createOrUpdateCourse = async () => {
    const payload = { title: newCourseTitle, description: newCourseDesc, category: newCourseCategory }
    try {
      if (editingCourseId) await supabase.from('courses').update(payload).eq('id', editingCourseId)
      else await supabase.from('courses').insert({ ...payload, created_by: user.id })
      setNewCourseTitle(''); setNewCourseDesc(''); setEditingCourseId(null); setView('courses'); fetchCourses('teacher', user.id)
    } catch (e: any) { alert(e.message) }
  }

  const deleteCourse = async (id: number) => {
    if (confirm("¿Eliminar curso?")) { await supabase.from('courses').delete().eq('id', id); fetchCourses('teacher', user.id); }
  }

  const leaveCourse = async (id: number) => {
    if (confirm("¿Salir del curso?")) { await supabase.from('enrollments').delete().eq('course_id', id).eq('student_id', user.id); fetchCourses('student', user.id); }
  }

  // --- 5. RENDERIZADO VISUAL ---
  const renderRichText = (text: string, category: CourseCategory) => {
    if (!text) return null
    return text.split(/(```[\s\S]*?```)/g).map((block, i) => {
      if (block.startsWith('```')) {
        const code = block.slice(3, -3).replace(/^.*\n/, '')
        return <div key={i} className="my-3 bg-[#1e1e1e] rounded-lg border border-gray-700 overflow-hidden"><div className="bg-[#2d2d2d] px-3 py-1 text-xs text-gray-400">Ejemplo</div><pre className="p-3 text-sm text-gray-200 overflow-x-auto font-mono" dangerouslySetInnerHTML={{ __html: highlightCode(code) }}/></div>
      }
      let fmt = block
      if (category === 'math') {
        fmt = fmt.replace(/\$\$(.*?)\$\$/g, '<div class="my-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded text-center font-serif text-lg">$1</div>')
        fmt = fmt.replace(/\$(.*?)\$/g, '<span class="font-serif italic bg-gray-100 dark:bg-gray-800 px-1 rounded mx-1">$1</span>')
      }
      fmt = fmt.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/^\* (.*$)/gm, '<li class="ml-4 list-disc">$1</li>').replace(/\n/g, '<br/>')
      return <span key={i} dangerouslySetInnerHTML={{ __html: fmt }} className={category === 'letters' ? 'font-serif text-lg leading-relaxed' : ''}/>
    })
  }

  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') { e.preventDefault(); e.currentTarget.setRangeText('  ', e.currentTarget.selectionStart, e.currentTarget.selectionStart, 'end'); }
  }

  // --- RENDER ---
  if (!mounted) return null
  if (loadingProfile) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><RefreshCw className="animate-spin text-blue-600 w-8 h-8"/></div>

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
            <Book className="w-5 h-5" /> <span className="hidden lg:block">Mis Cursos</span>
          </button>
          <button onClick={() => { setView('create'); setEditingCourseId(null); setNewCourseTitle(''); setNewCourseDesc(''); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'create' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            {profile?.role === 'teacher' ? <Plus className="w-5 h-5" /> : <Search className="w-5 h-5" />} 
            <span className="hidden lg:block">{profile?.role === 'teacher' ? 'Crear Curso' : 'Explorar'}</span>
          </button>
        </nav>
        <div className="p-4 border-t dark:border-gray-800 flex gap-2">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 flex justify-center"><Sun className="w-5 h-5 hidden dark:block"/><Moon className="w-5 h-5 block dark:hidden"/></button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="flex-1 p-2 rounded-lg bg-red-50 text-red-500 flex justify-center"><LogOut className="w-5 h-5"/></button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* LISTA CURSOS */}
        {view === 'courses' && (
          <div className="flex-1 overflow-y-auto p-8">
            <h1 className="text-2xl font-bold dark:text-white mb-6">Mis Cursos</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myCourses.map(c => (
                <div key={c.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all relative group">
                  <div className={`h-32 p-6 flex flex-col justify-end relative ${c.category === 'math' ? 'bg-blue-600' : c.category === 'programming' ? 'bg-slate-800' : 'bg-orange-500'}`}>
                     <span className="absolute top-4 right-4 bg-white/20 text-white text-xs px-2 py-1 rounded font-bold uppercase">{c.category}</span>
                     <h3 className="text-white font-bold text-xl">{c.title}</h3>
                  </div>
                  <div className="p-6">
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">{c.description}</p>
                    <div className="flex gap-2">
                      {profile?.role === 'teacher' ? (
                        <>
                          <button onClick={() => { setSelectedCourse(c); setSyllabusInput(c.syllabus || ''); fetchEnrolledStudents(c.id); fetchSessions(c.id); setView('course_detail'); }} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-semibold text-sm">Gestionar</button>
                          <button onClick={() => { setEditingCourseId(c.id); setNewCourseTitle(c.title); setNewCourseDesc(c.description); setView('create'); }} className="p-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><Edit className="w-4 h-4"/></button>
                          <button onClick={() => deleteCourse(c.id)} className="p-2 text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setSelectedCourse(c); setView('course_detail'); fetchSessions(c.id); fetchChatHistory(c.id); }} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700">Entrar</button>
                          <button onClick={() => leaveCourse(c.id)} className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg"><LogOut className="w-4 h-4"/></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DETALLE CURSO */}
        {view === 'course_detail' && selectedCourse && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#0b1120] relative">
               <div className="h-16 bg-white dark:bg-gray-900 border-b dark:border-gray-800 flex items-center justify-between px-6 shrink-0">
                 <div className="flex items-center gap-3">
                   <button onClick={() => setView('courses')} className="text-gray-400 hover:text-gray-600"><ArrowLeft/></button>
                   <h2 className="font-bold dark:text-white">{selectedCourse.title}</h2>
                 </div>
               </div>

               {profile?.role === 'teacher' ? (
                 <div className="flex-1 p-8 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                   <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border dark:border-gray-700 h-fit">
                     <h3 className="font-bold text-lg mb-4 flex items-center gap-2 dark:text-white"><Users className="w-5 h-5 text-indigo-500"/> Estudiantes ({enrolledStudents.length})</h3>
                     <ul className="space-y-3">{enrolledStudents.map(st => (<li key={st.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"><div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">{st.full_name?.[0] || 'U'}</div><span className="text-sm dark:text-gray-200">{st.full_name || 'Usuario'}</span></li>))}</ul>
                   </div>
                   <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border dark:border-gray-700 h-full flex flex-col">
                     <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg flex items-center gap-2 dark:text-white"><ListChecks className="w-5 h-5 text-green-500"/> Sílabo</h3><button onClick={generateSyllabus} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold flex items-center gap-1"><Lightbulb className="w-3 h-3"/> IA</button></div>
                     <textarea className="flex-1 w-full bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-xl p-4 text-sm font-mono resize-none focus:ring-2 focus:ring-green-500 outline-none dark:text-gray-200" placeholder="1. Introducción..." value={syllabusInput} onChange={e => setSyllabusInput(e.target.value)}/>
                     <button onClick={saveSyllabus} className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-xl font-bold">Guardar Sílabo</button>
                   </div>
                 </div>
               ) : (
                 <>
                   <div className="flex-1 overflow-y-auto p-6 space-y-6">
                     {messages.length === 0 && <div className="text-center py-20 opacity-60"><Bot className="w-16 h-16 mx-auto mb-4 text-indigo-300"/><button onClick={() => initAiConversation(selectedCourse)} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-full font-bold">Comenzar Clase</button></div>}
                     {messages.map((msg, i) => (
                       <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-3xl mx-auto w-full animate-in slide-in-from-bottom-2`}>
                         <div className={`flex gap-3 max-w-[95%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-green-600'}`}>{msg.role === 'user' ? <User className="text-white w-4 h-4"/> : <Bot className="text-white w-4 h-4"/>}</div>
                           <div className="flex flex-col gap-2 w-full">
                             <div className={`p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 dark:text-gray-100 rounded-tl-none border dark:border-gray-700'}`}>
                               <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.role === 'model' ? renderRichText(msg.content, selectedCourse.category) : msg.content}</div>
                             </div>
                             {msg.options && <div className="flex flex-wrap gap-2 mt-1">{msg.options.map((opt, idx) => (<button key={idx} onClick={() => handleSendMessage(opt)} className="bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-indigo-900/30 px-4 py-2 rounded-xl text-sm hover:border-indigo-500 font-medium dark:text-gray-300">{opt}</button>))}</div>}
                             {msg.isCodeRequest && (
                               <div className="w-full bg-[#1e1e1e] rounded-xl overflow-hidden shadow-lg border border-gray-700 mt-2">
                                 <div className="bg-[#252526] px-4 py-2 flex items-center justify-between border-b border-[#333]"><span className="text-gray-400 text-xs flex items-center gap-2"><CodeIcon className="w-3 h-3 text-blue-400" /> Editor</span></div>
                                 <textarea ref={editorRef} disabled={!codeEditorVisible && i !== messages.length - 1} onKeyDown={handleCodeKeyDown} className="w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-4 h-64 outline-none resize-none" placeholder="// Código..." value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} spellCheck={false}/>
                                 {codeEditorVisible && i === messages.length - 1 && (<div className="p-3 bg-[#252526] flex justify-end border-t border-[#333]"><button onClick={() => handleSendMessage()} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2"><Play className="w-3 h-3" /> Ejecutar</button></div>)}
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
                         <input className="flex-1 bg-transparent px-4 py-2 outline-none dark:text-white" placeholder="Mensaje..." value={inputMsg} onChange={e => setInputMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} disabled={aiLoading}/>
                         <button onClick={() => handleSendMessage()} disabled={!inputMsg.trim()} className="p-2 bg-indigo-600 rounded-full text-white hover:bg-indigo-700 disabled:opacity-50"><Send className="w-4 h-4"/></button>
                       </div>
                     </div>
                   )}
                 </>
               )}
            </div>

            {/* DERECHA: ASESORÍAS */}
            <div className="w-full md:w-72 bg-white dark:bg-[#0f172a] border-l dark:border-gray-800 overflow-y-auto p-6 shrink-0">
               <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center gap-2"><Video className="w-5 h-5 text-purple-500"/> Asesorías</h3>
               {profile?.role === 'teacher' && selectedCourse.created_by === user?.id && (
                 <button onClick={() => setShowSessionForm(!showSessionForm)} className="w-full mb-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 text-xs font-bold hover:border-purple-500 hover:text-purple-500 uppercase flex items-center justify-center gap-2"><Plus className="w-4 h-4"/> Nueva Sesión</button>
               )}
               {showSessionForm && (
                 <div className="mb-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border dark:border-gray-700 space-y-2">
                   <input type="date" className="w-full p-2 text-xs rounded border dark:bg-gray-900 dark:border-gray-600" onChange={e => setSessionData({...sessionData, date: e.target.value})}/>
                   <input type="time" className="w-full p-2 text-xs rounded border dark:bg-gray-900 dark:border-gray-600" onChange={e => setSessionData({...sessionData, time: e.target.value})}/>
                   <input type="url" placeholder="Link" className="w-full p-2 text-xs rounded border dark:bg-gray-900 dark:border-gray-600" onChange={e => setSessionData({...sessionData, link: e.target.value})}/>
                   <button className="w-full bg-purple-600 text-white py-1 rounded text-xs font-bold" onClick={async () => {
                     await supabase.from('sessions').insert({ course_id: selectedCourse.id, ...sessionData })
                     setShowSessionForm(false); fetchSessions(selectedCourse.id);
                   }}>Confirmar</button>
                 </div>
               )}
               <div className="space-y-2">
                 {courseSessions.length === 0 ? <p className="text-xs text-gray-400 text-center">No hay sesiones</p> : courseSessions.map((s, i) => (
                   <div key={i} className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800">
                     <p className="text-xs font-bold text-purple-700 dark:text-purple-300">{s.date} - {s.time}</p>
                     <a href={s.link} target="_blank" className="mt-2 text-xs bg-white dark:bg-gray-800 border px-2 py-1 rounded flex items-center gap-1 w-full justify-center hover:bg-purple-50 dark:hover:bg-purple-900/30"><ExternalLink className="w-3 h-3"/> Unirse</a>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {/* CREAR */}
        {view === 'create' && (
          <div className="flex-1 overflow-y-auto p-8 flex justify-center">
             <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 h-fit">
               <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold dark:text-white">{profile?.role === 'teacher' ? (editingCourseId ? 'Editar' : 'Crear') : 'Explorar'}</h2><button onClick={() => setView('courses')} className="text-gray-400 hover:text-gray-600">Cancelar</button></div>
               {profile?.role === 'teacher' ? (
                 <div className="space-y-5">
                   <div><label className="block text-sm font-bold mb-2 dark:text-gray-300">Título</label><input className="w-full p-3 border rounded-xl dark:bg-gray-900 dark:border-gray-700 dark:text-white" value={newCourseTitle} onChange={e => setNewCourseTitle(e.target.value)} /></div>
                   <div className="grid grid-cols-3 gap-3">{['math', 'letters', 'programming'].map(cat => <button key={cat} onClick={() => setNewCourseCategory(cat as any)} className={`p-3 rounded-xl border text-sm font-bold capitalize transition-all ${newCourseCategory === cat ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}`}>{cat}</button>)}</div>
                   <div><label className="block text-sm font-bold mb-2 dark:text-gray-300">Descripción</label><textarea className="w-full p-3 border rounded-xl h-32 dark:bg-gray-900 dark:border-gray-700 dark:text-white" value={newCourseDesc} onChange={e => setNewCourseDesc(e.target.value)} /></div>
                   <button onClick={createOrUpdateCourse} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg">Publicar</button>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {courses.map(c => (
                     <div key={c.id} className="border dark:border-gray-700 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                       <h3 className="font-bold dark:text-white">{c.title}</h3><p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-4 line-clamp-2">{c.description}</p>
                       <button onClick={async () => { await supabase.from('enrollments').insert({ student_id: user.id, course_id: c.id }); fetchCourses('student', user.id); alert('Inscrito') }} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Inscribirse</button>
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