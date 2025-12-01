'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { chatWithGemini } from '../actions'
import { 
  LogOut, Plus, Book, User, Send, Bot, 
  GraduationCap, Sun, Moon, Search, RefreshCw, 
  Video, ExternalLink, Trash2, Edit, Users, 
  ListChecks, ArrowLeft, Terminal, X, GripVertical, 
  Check, Play, Code as CodeIcon, Calculator, Feather,
  LogOut as LeaveIcon, AlertCircle, Save, Ban
} from 'lucide-react'
import { useTheme } from 'next-themes'

// --- TIPOS ---
type Profile = { id: string, role: 'student' | 'teacher', full_name: string, avatar_url?: string, email?: string }
type CourseCategory = 'math' | 'programming' | 'letters' | 'other'

type Course = { 
  id: number, 
  title: string, 
  description: string, 
  category: CourseCategory,
  created_by: string,
  syllabus?: string,
  is_published?: boolean,
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

// --- UTILIDADES ---

const parseMessageContent = (rawText: string) => {
  const optionRegex = /\{\{(.+?)\}\}/;
  const match = rawText.match(optionRegex);
  let options: string[] = [];
  let content = rawText;
  let isCodeRequest = false;

  if (rawText.includes('{{CODE_REQUEST}}')) {
      isCodeRequest = true;
      content = rawText.replace('{{CODE_REQUEST}}', '').trim();
  } else if (match) {
      options = match[1].split('|').map(o => o.trim());
      content = rawText.replace(match[0], '').trim();
  }

  if (content.includes('{{CODE_REQUEST}}')) {
      isCodeRequest = true;
      content = content.replace('{{CODE_REQUEST}}', '').trim();
  }

  return { content, options: options.length > 0 ? options : undefined, isCodeRequest };
}

const highlightCode = (code: string) => {
  if (!code) return '';
  let highlighted = code
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const keywords = /\b(function|const|let|var|if|else|return|import|from|class|export|async|await|def|for|while|try|catch|public|private|protected|static|void|int|float|double|bool|boolean|string|String|new|this|extends|implements|interface|type|package|namespace|using|include|struct|template|typename|override|virtual|final|None|True|False|null|undefined)\b/g;
  const builtins = /\b(console|log|map|filter|reduce|push|print|len|range|std|cout|cin|printf|scanf|System|out|println)\b/g;
  const strings = /('.*?'|".*?"|`.*?`)/g;
  const numbers = /\b(\d+)\b/g;
  const comments = /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/)/gm;

  highlighted = highlighted
    .replace(keywords, '<span class="text-purple-400 font-bold">$1</span>')
    .replace(builtins, '<span class="text-blue-400">$1</span>')
    .replace(strings, '<span class="text-green-400">$1</span>')
    .replace(numbers, '<span class="text-orange-400">$1</span>')
    .replace(comments, '<span class="text-gray-500 italic">$1</span>');

  return highlighted;
}

const CodeEditor = ({ value, onChange, onRun, readOnly }: { value: string, onChange: (v: string) => void, onRun?: () => void, readOnly?: boolean }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);

    const handleScroll = () => {
        if (textareaRef.current && preRef.current) {
            preRef.current.scrollTop = textareaRef.current.scrollTop;
            preRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const target = e.currentTarget;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            target.setRangeText('  ', start, end, 'end');
            onChange(target.value);
        }
    };

    return (
        <div className="relative w-full h-64 rounded-xl overflow-hidden border border-gray-700 bg-[#1e1e1e] shadow-2xl ring-4 ring-gray-900/5 group">
            <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#333] z-20 relative">
                <span className="text-xs font-bold text-gray-400 flex items-center gap-2">
                    <CodeIcon className="w-3 h-3 text-blue-400"/> EDITOR INTERACTIVO
                </span>
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"/>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"/>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"/>
                </div>
            </div>
            <div className="relative w-full h-[calc(100%-40px)]">
                <pre
                    ref={preRef}
                    aria-hidden="true"
                    className="absolute inset-0 p-4 m-0 font-mono text-sm leading-relaxed pointer-events-none whitespace-pre-wrap break-words overflow-hidden text-[#d4d4d4]"
                    dangerouslySetInnerHTML={{ __html: highlightCode(value || ' ') + '<br/>' }} 
                />
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onScroll={handleScroll}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    disabled={readOnly}
                    className={`absolute inset-0 w-full h-full p-4 m-0 font-mono text-sm leading-relaxed bg-transparent text-transparent caret-white resize-none outline-none whitespace-pre-wrap break-words overflow-auto z-10 ${readOnly ? 'opacity-0 cursor-default' : ''}`}
                    placeholder="// Escribe tu código aquí..."
                />
                {!readOnly && onRun && (
                    <button onClick={onRun} 
                        className="absolute bottom-4 right-4 z-30 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 hover:shadow-green-500/20">
                        <Play className="w-3 h-3 fill-current"/> EJECUTAR Y ENVIAR
                    </button>
                )}
            </div>
        </div>
    );
};

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
  const [loadingStudents, setLoadingStudents] = useState(false)
  
  // Formularios
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [newCourseDesc, setNewCourseDesc] = useState('')
  const [newCourseCategory, setNewCourseCategory] = useState<CourseCategory>('other')
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null)
  const [syllabusItems, setSyllabusItems] = useState<string[]>([])

  // Chat y Editor
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [codeEditorVisible, setCodeEditorVisible] = useState(false)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionData, setSessionData] = useState({ date: '', time: '', link: '' })
  
  const chatEndRef = useRef<HTMLDivElement>(null)

  // --- HELPER: RESET FORM ---
  const resetForm = () => {
    setNewCourseTitle('');
    setNewCourseDesc('');
    setNewCourseCategory('other');
    setEditingCourseId(null);
  }

  // --- CARGA INICIAL ---
  const fetchProfile = useCallback(async (currentUser: any) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle()
      
      const updates = {
          id: currentUser.id,
          full_name: currentUser.email, 
          email: currentUser.email,     
          role: data?.role || 'student', 
          updated_at: new Date().toISOString()
      };

      if (!data || error) {
        await supabase.from('profiles').upsert(updates)
        window.location.reload()
        return
      } else {
        await supabase.from('profiles').update(updates).eq('id', currentUser.id)
      }

      setProfile(data)
      setLoadingProfile(false)
      fetchCourses(data.role, currentUser.id)
    } catch (err) { console.error(err); setLoadingProfile(false) }
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, codeEditorVisible])
  
  useEffect(() => {
    if (view === 'course_detail' && selectedCourse && profile?.role === 'teacher') {
        fetchEnrolledStudents(selectedCourse.id)
    }
  }, [view, selectedCourse, profile])

  // --- GESTIÓN DE CURSOS ---
  const fetchCourses = async (role: string | undefined, userId: string) => {
    try {
      let allData: any[] = []
      const { data: dataWithProfiles, error: errorProfiles } = await supabase.from('courses').select('*, profiles(full_name)')
      
      if (!errorProfiles && dataWithProfiles) allData = dataWithProfiles
      else {
        const { data: rawData } = await supabase.from('courses').select('*')
        allData = rawData || []
      }

      if (role === 'teacher') {
        const my = allData.filter(c => c.created_by === userId)
        setMyCourses(my)
        setCourses(allData)
      } else {
        const { data: enrollData } = await supabase.from('enrollments').select('course_id').eq('student_id', userId)
        const enrolledIds = new Set(enrollData?.map((e: any) => e.course_id) || [])
        const my = allData.filter(c => enrolledIds.has(c.id))
        setMyCourses(my)
        const available = allData.filter(c => !enrolledIds.has(c.id))
        setCourses(available)
      }
    } catch (e) { console.error("Error fetching courses:", e) }
  }

  // --- GESTIÓN DE ESTUDIANTES ---
  const fetchEnrolledStudents = async (courseId: number) => {
    setLoadingStudents(true)
    try {
        const { data: enrollments } = await supabase.from('enrollments').select('student_id').eq('course_id', courseId)
        
        if (!enrollments || enrollments.length === 0) { 
            setEnrolledStudents([]); 
            setLoadingStudents(false)
            return 
        }

        const ids = enrollments.map(e => e.student_id)
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids)
        
        const validProfiles = profiles || []
        const foundIds = new Set(validProfiles.map(p => p.id))
        
        // Fallback visual robusto
        const placeholders: Profile[] = ids
            .filter(id => !foundIds.has(id))
            .map(id => ({ 
                id, 
                role: 'student', 
                full_name: '', 
                email: id // Usar ID como email temporal
            }))
        
        setEnrolledStudents([...validProfiles, ...placeholders])
    } catch (e) { console.error("Error fetching students:", e) 
    } finally { setLoadingStudents(false) }
  }

  const fetchSessions = async (courseId: number) => {
    const { data } = await supabase.from('sessions').select('*').eq('course_id', courseId).order('date', { ascending: true })
    setCourseSessions(data || [])
  }

  // --- CHAT IA ---
  const fetchChatHistory = async (courseId: number) => {
    if (!user) return
    setAiLoading(true)
    const { data } = await supabase.from('chat_messages').select('*').eq('course_id', courseId).eq('user_id', user.id).order('created_at', { ascending: true })
    
    if (data && data.length > 0) {
      setMessages(data.map(m => ({
        id: m.id, role: m.role as 'user' | 'model', content: m.content, timestamp: new Date(m.created_at),
        options: m.options ? (typeof m.options === 'string' ? JSON.parse(m.options) : m.options) : undefined, 
        isCodeRequest: m.is_code_request
      })))
      if (data[data.length - 1].is_code_request) setCodeEditorVisible(true)
    } else {
      setMessages([])
    }
    setAiLoading(false)
  }

  const initAiConversation = async (course: Course) => {
    const sysPrompt = getSystemPrompt(course)
    const res = await chatWithGemini("Hola, soy el estudiante. Inicia la clase saludando y hazme una pregunta del primer tema. Si es una pregunta teórica, dame opciones.", sysPrompt, [])
    if (res.success) processAiResponse(res.message, course.id)
  }

  const handleSendMessage = async (msgOverride?: string) => {
    const txt = msgOverride || inputMsg
    if (!txt.trim() || !selectedCourse) return

    const userMsg: Message = { role: 'user', content: txt, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInputMsg('')
    setAiLoading(true)
    setCodeEditorVisible(false) 

    await supabase.from('chat_messages').insert({ user_id: user.id, course_id: selectedCourse.id, role: 'user', content: txt })

    const sysPrompt = getSystemPrompt(selectedCourse)
    const historyForAi = messages.map(m => ({ role: m.role, content: m.content }))
    
    const res = await chatWithGemini(txt, sysPrompt, historyForAi)
    if (res.success) processAiResponse(res.message, selectedCourse.id)
    setAiLoading(false)
  }

  const processAiResponse = async (textRaw: string, courseId: number) => {
    const { content, options, isCodeRequest } = parseMessageContent(textRaw)
    const aiMsg: Message = { role: 'model', content, timestamp: new Date(), options, isCodeRequest }
    setMessages(prev => [...prev, aiMsg])
    await supabase.from('chat_messages').insert({ 
      user_id: user.id, course_id: courseId, role: 'model', content, 
      options: options ? JSON.stringify(options) : null, is_code_request: isCodeRequest 
    })
    if (isCodeRequest) setCodeEditorVisible(true)
  }

  const getSystemPrompt = (course: Course) => {
    let syllabusList = "Temas generales."
    try {
      if (course.syllabus) {
        const parsed = JSON.parse(course.syllabus)
        syllabusList = Array.isArray(parsed) ? parsed.join(", ") : course.syllabus
      }
    } catch { syllabusList = course.syllabus || "" }

    const categoryPrompts = {
      math: "Eres Profesor de Matemáticas. USA FORMATO LaTeX $$...$$ para formulas complejas.",
      programming: `Eres Senior Developer Mentor. 1. Si es pregunta teórica, usa {{Opción A|Opción B}}. 2. Si pides código, termina con {{CODE_REQUEST}}.`,
      letters: "Eres Profesor de Literatura. Usa citas con >.",
      other: "Eres un tutor experto."
    }
    const specificRole = categoryPrompts[course.category] || categoryPrompts.other
    return `CONTEXTO: Curso "${course.title}". TEMARIO: [${syllabusList}]. ROL: ${specificRole}. REGLAS: Opción múltiple con {{A|B}}, Matemáticas $$, Código {{CODE_REQUEST}}.`
  }

  const renderRichMessage = (text: string, category: CourseCategory) => {
    if (!text) return null;
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const code = part.slice(3, -3).replace(/^.*\n/, ''); 
        return (
          <div key={index} className="my-3 rounded-lg overflow-hidden border border-gray-700 bg-[#1e1e1e] shadow-lg">
            <div className="bg-[#2d2d2d] px-3 py-1 text-xs text-gray-400 border-b border-gray-700 flex items-center gap-2">
              <Terminal className="w-3 h-3"/> Ejemplo de Código
            </div>
            <pre className="p-3 overflow-x-auto text-sm font-mono text-[#abb2bf] leading-tight" 
                 dangerouslySetInnerHTML={{ __html: highlightCode(code) }} />
          </div>
        );
      }
      let content = part;
      if (content.includes('> ') || content.match(/".{20,}"/)) {
         content = content.replace(/^> (.*$)/gm, '<div class="my-4 p-4 bg-[#fdf6e3] dark:bg-[#2c2b25] border-l-4 border-[#d33682] text-[#657b83] dark:text-[#a8a19f] font-serif italic text-lg leading-relaxed shadow-sm">"$1"</div>');
         content = content.replace(/"([^"]{20,})"/g, '<div class="my-4 p-4 bg-[#fdf6e3] dark:bg-[#2c2b25] border-l-4 border-[#d33682] text-[#657b83] dark:text-[#a8a19f] font-serif italic text-lg leading-relaxed shadow-sm">"$1"</div>');
      }
      const mathBlocks = content.split(/(\$\$[\s\S]*?\$\$)/g);
      if (mathBlocks.length > 1) {
        return mathBlocks.map((block, i) => {
          if (block.startsWith('$$') && block.endsWith('$$')) {
            const formula = block.slice(2, -2);
            return <div key={`${index}-math-${i}`} className="my-4 py-4 px-6 bg-blue-50 dark:bg-[#1e293b] border-l-4 border-blue-500 rounded-r-lg shadow-sm text-center overflow-x-auto"><span className="font-serif text-xl md:text-2xl text-slate-800 dark:text-slate-200 tracking-wide font-medium">{formula}</span></div>;
          }
          return <span key={`${index}-txt-${i}`} dangerouslySetInnerHTML={{ __html: formatInlineText(block, category) }} />;
        });
      }
      return <span key={index} dangerouslySetInnerHTML={{ __html: formatInlineText(content, category) }} />;
    });
  };

  const formatInlineText = (text: string, cat: CourseCategory) => {
    let fmt = text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-indigo-600 dark:text-indigo-400">$1</strong>')
      .replace(/^\* (.*$)/gm, '<li class="ml-4 list-disc marker:text-indigo-500 mb-1">$1</li>')
      .replace(/\n/g, '<br/>');
    fmt = fmt.replace(/\$([^$]+?)\$/g, '<span class="font-serif italic bg-gray-100 dark:bg-gray-800 px-1 rounded text-pink-600 dark:text-pink-400 font-medium">$1</span>');
    return fmt;
  }

  // --- ACCIONES CRUD MEJORADAS ---
  
  const createOrUpdateCourse = async () => {
    if (!user) return;
    const payload = { title: newCourseTitle, description: newCourseDesc, category: newCourseCategory };
    
    try {
        if (editingCourseId) {
            // Actualización
            const { error } = await supabase.from('courses').update(payload).eq('id', editingCourseId);
            if (error) throw error;
            
            // Actualizar estado local inmediatamente
            setMyCourses(prev => prev.map(c => c.id === editingCourseId ? { ...c, ...payload } : c));
            if (selectedCourse?.id === editingCourseId) {
                setSelectedCourse({ ...selectedCourse, ...payload });
            }
        } else {
            // Creación
            const { error } = await supabase.from('courses').insert({ ...payload, created_by: user.id, is_published: true });
            if (error) throw error;
            fetchCourses('teacher', user.id); // Recargar lista para obtener ID nuevo
        }
        
        resetForm();
        setView('courses');
    } catch (e: any) {
        alert("Error al guardar: " + e.message);
    }
  }

  // ELIMINACIÓN EN CASCADA (Soluciona el error de FK)
  const handleDeleteCourse = async (courseId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if(!confirm("ADVERTENCIA: Esto borrará TODOS los datos del curso (estudiantes, chats, sesiones). ¿Estás seguro?")) return;
    
    try {
        // 1. Obtener sesiones AI para borrar sus mensajes
        const { data: aiSessions } = await supabase.from('ai_sessions').select('id').eq('course_id', courseId);
        const aiSessionIds = aiSessions?.map(s => s.id) || [];

        if (aiSessionIds.length > 0) {
            await supabase.from('ai_messages').delete().in('session_id', aiSessionIds);
            await supabase.from('ai_sessions').delete().eq('course_id', courseId);
        }

        // 2. Borrar todo lo demás
        await supabase.from('chat_messages').delete().eq('course_id', courseId);
        await supabase.from('enrollments').delete().eq('course_id', courseId);
        await supabase.from('sessions').delete().eq('course_id', courseId);
        await supabase.from('tutoring_sessions').delete().eq('course_id', courseId);
        
        // 3. Finalmente borrar el curso
        const { error } = await supabase.from('courses').delete().eq('id', courseId);
        
        if (error) throw error;
        
        // Actualizar UI
        setMyCourses(prev => prev.filter(c => c.id !== courseId));
        setCourses(prev => prev.filter(c => c.id !== courseId));
        
    } catch (e: any) {
        alert("Error crítico al eliminar: " + e.message);
        console.error(e);
    }
  }

  const handleLeaveCourse = async () => {
    if(!selectedCourse || !user) return;
    if(!confirm(`¿Deseas abandonar el curso "${selectedCourse.title}"?`)) return;
    const { error } = await supabase.from('enrollments').delete().match({ student_id: user.id, course_id: selectedCourse.id });
    if (error) alert("No se pudo abandonar el curso.");
    else { setView('courses'); fetchCourses('student', user.id); }
  }

  const handleEditCourse = (course: Course, e: React.MouseEvent) => {
    e.stopPropagation();
    setNewCourseTitle(course.title);
    setNewCourseDesc(course.description);
    setNewCourseCategory(course.category);
    setEditingCourseId(course.id);
    setView('create');
  }
  
  const generateSyllabus = async () => {
    if (!selectedCourse) return
    const res = await chatWithGemini(`Genera un array JSON estricto de 5 temas para "${selectedCourse.title}". Formato: ["Tema 1", "Tema 2"]`, "System", [])
    if (res.success) {
      const match = res.message.match(/\[[\s\S]*\]/)
      if (match) setSyllabusItems(JSON.parse(match[0]))
    }
  }

  const saveSyllabus = async () => {
    if (!selectedCourse) return
    const json = JSON.stringify(syllabusItems)
    await supabase.from('courses').update({ syllabus: json }).eq('id', selectedCourse.id)
    setSelectedCourse({ ...selectedCourse, syllabus: json })
    alert("Sílabo actualizado")
  }

  if (!mounted) return null
  if (loadingProfile) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950"><RefreshCw className="animate-spin text-indigo-600 w-10 h-10"/></div>

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#020617] text-gray-800 dark:text-gray-200 font-sans text-sm md:text-base overflow-hidden transition-colors duration-300">
      
      {/* SIDEBAR */}
      <aside className="w-20 lg:w-64 bg-white dark:bg-[#0f172a] border-r border-gray-200 dark:border-gray-800 flex flex-col z-20 shadow-xl">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b dark:border-gray-800 gap-3">
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 p-2 rounded-lg text-white shadow-lg"><GraduationCap size={20} /></div>
          <span className="font-bold text-xl dark:text-white hidden lg:block tracking-tight">E-Learning</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => { setView('courses'); resetForm(); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${view === 'courses' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            <Book className="w-5 h-5" /> <span className="hidden lg:block">Mis Cursos</span>
          </button>
          
          <button onClick={() => { resetForm(); setView('create'); fetchCourses(profile?.role, user.id); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${view === 'create' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            {profile?.role === 'teacher' ? <Plus className="w-5 h-5" /> : <Search className="w-5 h-5" />} 
            <span className="hidden lg:block">{profile?.role === 'teacher' ? 'Crear Curso' : 'Explorar'}</span>
          </button>
        </nav>

        <div className="p-4 border-t dark:border-gray-800 space-y-2">
           <div className="flex items-center gap-3 px-2 mb-2">
             <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">{profile?.full_name?.[0]}</div>
             <div className="hidden lg:block overflow-hidden">
               <p className="text-sm font-bold truncate">{profile?.full_name}</p>
               <p className="text-xs text-gray-400 capitalize">{profile?.role}</p>
             </div>
           </div>
           <div className="flex gap-2">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex justify-center"><Sun className="w-4 h-4 hidden dark:block"/><Moon className="w-4 h-4 block dark:hidden"/></button>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="flex-1 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 flex justify-center"><LogOut className="w-4 h-4"/></button>
           </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* VISTA: MIS CURSOS */}
        {view === 'courses' && (
          <div className="flex-1 overflow-y-auto p-6 lg:p-10">
            <h1 className="text-3xl font-bold dark:text-white mb-2">Bienvenido de nuevo, {profile?.full_name?.split(' ')[0]}</h1>
            <p className="text-gray-500 mb-8">Continúa donde lo dejaste.</p>
            
            {myCourses.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed dark:border-gray-700">
                <Book className="w-16 h-16 text-gray-300 mx-auto mb-4"/>
                <p className="text-gray-500">No estás inscrito en ningún curso.</p>
                <button onClick={() => { resetForm(); setView('create'); }} className="mt-4 text-indigo-600 font-bold hover:underline">Ir a Explorar Cursos</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myCourses.map(c => (
                  <div key={c.id} onClick={() => { setSelectedCourse(c); setView('course_detail'); fetchChatHistory(c.id); fetchSessions(c.id); if(profile?.role==='teacher') { try { const parsed = JSON.parse(c.syllabus || '[]'); setSyllabusItems(Array.isArray(parsed) ? parsed : []); } catch { setSyllabusItems([]); }} }}
                        className="group bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative">
                    <div className={`h-36 p-6 flex flex-col justify-between relative overflow-hidden
                      ${c.category === 'math' ? 'bg-gradient-to-br from-blue-600 to-cyan-500' : 
                        c.category === 'programming' ? 'bg-gradient-to-br from-slate-800 to-black' : 
                        c.category === 'letters' ? 'bg-gradient-to-br from-amber-600 to-orange-500' : 
                        'bg-gradient-to-br from-indigo-600 to-violet-600'}`}>
                         <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4">
                           {c.category === 'math' ? <Calculator size={100} color="white"/> : c.category === 'programming' ? <Terminal size={100} color="white"/> : c.category === 'letters' ? <Feather size={100} color="white"/> : <Book size={100} color="white"/>}
                         </div>
                         <span className="self-end bg-white/20 backdrop-blur text-white text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider border border-white/10">{c.category}</span>
                         <h3 className="text-white font-bold text-xl drop-shadow-md z-10">{c.title}</h3>
                    </div>
                    <div className="p-5">
                      <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-4 h-10">{c.description}</p>
                      <div className="flex items-center justify-between mt-2">
                         <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                            <User className="w-3 h-3"/> {c.profiles?.full_name || 'Profesor'}
                         </div>
                         
                         {/* BOTONES DE EDICIÓN PARA PROFESOR */}
                         {profile?.role === 'teacher' && (
                             <div className="flex gap-2">
                                 <button onClick={(e) => handleEditCourse(c, e)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-indigo-500 transition-colors" title="Editar">
                                     <Edit className="w-4 h-4"/>
                                 </button>
                                 <button onClick={(e) => handleDeleteCourse(c.id, e)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-red-500 transition-colors" title="Eliminar">
                                     <Trash2 className="w-4 h-4"/>
                                 </button>
                             </div>
                         )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VISTA: DETALLE DEL CURSO (AULA VIRTUAL) */}
        {view === 'course_detail' && selectedCourse && (
          <div className="flex-1 flex flex-col h-screen">
            {/* Header del Curso */}
            <header className="h-16 bg-white dark:bg-gray-900 border-b dark:border-gray-800 flex items-center justify-between px-6 shrink-0 z-10">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('courses')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"><ArrowLeft className="w-5 h-5"/></button>
                <div>
                  <h2 className="font-bold text-lg leading-none">{selectedCourse.title}</h2>
                  <span className="text-xs text-gray-500 capitalize">{selectedCourse.category}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                  {profile?.role === 'student' && (
                      <>
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-xs font-bold animate-pulse"><div className="w-2 h-2 bg-green-500 rounded-full"/> En Vivo</div>
                        <button onClick={handleLeaveCourse} className="text-xs bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/30 font-bold transition-colors flex items-center gap-1">
                            <LeaveIcon className="w-3 h-3"/> Abandonar
                        </button>
                      </>
                  )}
              </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
              {/* ZONA IZQUIERDA: CHAT / CONTENIDO */}
              <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#0b1120] relative">
                 {profile?.role === 'teacher' ? (
                   // VISTA PROFESOR (Gestión)
                   <div className="flex-1 p-8 overflow-y-auto grid grid-cols-1 xl:grid-cols-2 gap-8">
                      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border dark:border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                           <h3 className="font-bold text-lg flex items-center gap-2"><Users className="text-indigo-500"/> Estudiantes ({enrolledStudents.length})</h3>
                           <button onClick={() => fetchEnrolledStudents(selectedCourse.id)} disabled={loadingStudents} className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-gray-500 hover:text-indigo-600 transition-colors" title="Actualizar lista">
                              <RefreshCw className={`w-3.5 h-3.5 ${loadingStudents ? 'animate-spin' : ''}`}/>
                           </button>
                        </div>
                        <div className="max-h-96 overflow-y-auto space-y-2">
                           {enrolledStudents.map(st => (
                             <div key={st.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors">
                               <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs">{st.email ? st.email[0].toUpperCase() : (st.full_name ? st.full_name[0].toUpperCase() : 'U')}</div>
                               <span className="text-sm font-medium">
                                   {st.email && st.email.trim() !== '' ? st.email : 
                                    (st.full_name && st.full_name.trim() !== '' ? st.full_name : 
                                    `ID: ${st.id.slice(0, 8)}...`)}
                               </span>
                             </div>
                           ))}
                           {!loadingStudents && enrolledStudents.length === 0 && <p className="text-gray-400 text-sm italic">Sin inscritos aún.</p>}
                           {loadingStudents && <p className="text-gray-400 text-xs animate-pulse">Cargando...</p>}
                        </div>
                        {enrolledStudents.some(s => !s.email && !s.full_name) && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-start gap-2 text-xs text-blue-600 dark:text-blue-400">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>
                                <p>Nota: Algunos perfiles no son públicos. Los estudiantes deben iniciar sesión.</p>
                            </div>
                        )}
                      </div>

                      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border dark:border-gray-700 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                           <h3 className="font-bold text-lg flex items-center gap-2"><ListChecks className="text-green-500"/> Plan de Estudios</h3>
                           <button onClick={generateSyllabus} className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg border border-green-200 font-bold hover:bg-green-100 transition-colors flex items-center gap-1"><Bot className="w-3 h-3"/> Generar con IA</button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                           {syllabusItems.map((item, idx) => (
                             <div key={idx} className="flex gap-2 items-start group">
                               <span className="mt-3 text-gray-300"><GripVertical className="w-4 h-4"/></span>
                               <textarea value={item} onChange={(e) => {const n = [...syllabusItems]; n[idx] = e.target.value; setSyllabusItems(n)}} 
                                         className="flex-1 bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-lg p-3 text-sm resize-none focus:ring-1 focus:ring-indigo-500 outline-none" rows={1}/>
                               <button onClick={() => {const n = syllabusItems.filter((_,i)=>i!==idx); setSyllabusItems(n)}} className="mt-3 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"><X className="w-4 h-4"/></button>
                             </div>
                           ))}
                           <button onClick={() => setSyllabusItems([...syllabusItems, ""])} className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-gray-400 text-sm hover:border-indigo-400 hover:text-indigo-500 transition-colors">+ Añadir Tema</button>
                        </div>
                        <button onClick={saveSyllabus} className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">Guardar Plan</button>
                      </div>
                   </div>
                 ) : (
                   // VISTA ESTUDIANTE (Chat IA)
                   <>
                     <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
                        {messages.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-full opacity-60">
                             <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4 animate-bounce">
                                <Bot className="w-10 h-10 text-indigo-500"/>
                             </div>
                             <h3 className="font-bold text-xl mb-2">Asistente de {selectedCourse.title}</h3>
                             <p className="text-sm text-gray-500 mb-6 text-center max-w-xs">Estoy aquí para enseñarte. Empecemos con el primer tema.</p>
                             <button onClick={() => initAiConversation(selectedCourse)} className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700 hover:shadow-indigo-500/30 transition-all transform hover:scale-105">Iniciar Clase</button>
                          </div>
                        )}
                        
                        {messages.map((msg, i) => (
                          <div key={i} className={`flex flex-col w-full max-w-3xl mx-auto ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-4 fade-in duration-500`}>
                             <div className={`flex gap-3 max-w-[95%] md:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center shadow-sm mt-1 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-500'}`}>
                                    {msg.role === 'user' ? <User className="w-4 h-4 text-white"/> : <Bot className="w-4 h-4 text-white"/>}
                                </div>
                                <div className="flex flex-col gap-2 w-full">
                                   <div className={`p-4 md:p-5 rounded-2xl shadow-sm leading-relaxed text-[15px] ${
                                      msg.role === 'user' 
                                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                                      : 'bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-tl-none'
                                   }`}>
                                      {msg.role === 'model' ? renderRichMessage(msg.content, selectedCourse.category) : msg.content}
                                   </div>

                                   {/* BOTONES DE OPCIONES (INTERACTIVOS) */}
                                   {msg.options && (
                                     <div className="flex flex-wrap gap-2 mt-1 animate-in fade-in zoom-in duration-300">
                                        {msg.options.map((opt, idx) => (
                                           <button key={idx} onClick={() => handleSendMessage(opt)} 
                                             className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 transition-all transform hover:-translate-y-0.5 active:scale-95">
                                               {opt}
                                           </button>
                                        ))}
                                     </div>
                                   )}

                                   {/* EDITOR DE CÓDIGO INCRUSTADO (Solo si se pidió) */}
                                   {msg.isCodeRequest && (
                                     <div className="mt-2 w-full">
                                        <CodeEditor 
                                            value={inputMsg} 
                                            onChange={(v) => setInputMsg(v)} 
                                            onRun={() => handleSendMessage()}
                                            readOnly={i !== messages.length - 1 || !codeEditorVisible}
                                        />
                                     </div>
                                   )}
                                </div>
                             </div>
                          </div>
                        ))}
                        <div ref={chatEndRef} className="h-4"/>
                     </div>
                     
                     {/* INPUT CHAT (Solo si no hay editor activo) */}
                     {!codeEditorVisible && (
                       <div className="p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 z-20">
                          <div className="max-w-3xl mx-auto flex gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-full border dark:border-gray-700 shadow-inner focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                             <input className="flex-1 bg-transparent px-4 outline-none text-sm dark:text-white placeholder:text-gray-400" 
                               placeholder="Escribe tu mensaje..." value={inputMsg} onChange={e => setInputMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} disabled={aiLoading}/>
                             <button onClick={() => handleSendMessage()} disabled={!inputMsg.trim() || aiLoading} 
                               className="w-10 h-10 bg-indigo-600 rounded-full text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-md">
                               {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4 ml-0.5"/>}
                             </button>
                          </div>
                       </div>
                     )}
                   </>
                 )}
              </div>

              {/* ZONA DERECHA: PANELES AUXILIARES */}
              <div className="w-80 bg-white dark:bg-[#0f172a] border-l dark:border-gray-800 hidden xl:flex flex-col shrink-0">
                 <div className="p-6 overflow-y-auto flex-1">
                    <h3 className="font-bold text-sm uppercase text-gray-400 mb-4 flex items-center gap-2"><Video className="w-4 h-4"/> Sesiones en Vivo</h3>
                    {profile?.role === 'teacher' && selectedCourse.created_by === user?.id && (
                       <button onClick={() => setShowSessionForm(!showSessionForm)} className="w-full mb-4 py-2 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-indigo-500 text-gray-400 hover:text-indigo-500 rounded-xl text-xs font-bold transition-all">+ Nueva Sesión</button>
                    )}
                    
                    {showSessionForm && (
                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 mb-4 animate-in slide-in-from-top-2">
                        <div className="space-y-2">
                          <input type="date" className="w-full text-xs p-2 rounded border dark:bg-gray-900 dark:border-gray-600" onChange={e => setSessionData({...sessionData, date: e.target.value})}/>
                          <input type="time" className="w-full text-xs p-2 rounded border dark:bg-gray-900 dark:border-gray-600" onChange={e => setSessionData({...sessionData, time: e.target.value})}/>
                          <input type="url" placeholder="Link (Zoom/Meet)" className="w-full text-xs p-2 rounded border dark:bg-gray-900 dark:border-gray-600" onChange={e => setSessionData({...sessionData, link: e.target.value})}/>
                          <button onClick={async () => {await supabase.from('sessions').insert({ course_id: selectedCourse.id, ...sessionData }); setShowSessionForm(false); fetchSessions(selectedCourse.id)}} className="w-full bg-indigo-600 text-white py-1.5 rounded text-xs font-bold">Crear</button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                       {courseSessions.length === 0 && <p className="text-gray-400 text-xs italic text-center py-4">No hay sesiones próximas.</p>}
                       {courseSessions.map((s, i) => (
                         <div key={i} className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 border border-indigo-100 dark:border-indigo-500/20">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-bold text-indigo-900 dark:text-indigo-300 text-sm">{s.date}</span>
                              <span className="text-xs bg-white dark:bg-gray-800 px-2 py-0.5 rounded border dark:border-gray-700">{s.time}</span>
                            </div>
                            <a href={s.link} target="_blank" className="text-xs flex items-center justify-center gap-1 w-full py-1.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"><ExternalLink className="w-3 h-3"/> Unirse</a>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA: CREAR / EXPLORAR */}
        {view === 'create' && (
          <div className="flex-1 overflow-y-auto p-6 flex justify-center items-start pt-10">
             <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-3xl shadow-xl border dark:border-gray-700 p-8">
                <div className="flex justify-between items-center mb-8 pb-4 border-b dark:border-gray-700">
                  <div>
                    <h2 className="text-2xl font-bold dark:text-white">{profile?.role === 'teacher' ? (editingCourseId ? 'Editar Curso' : 'Crear Nuevo Curso') : 'Explorar Cursos Disponibles'}</h2>
                    <p className="text-gray-500 text-sm mt-1">{profile?.role === 'teacher' ? 'Comparte tu conocimiento con el mundo.' : 'Encuentra tu próxima aventura de aprendizaje.'}</p>
                  </div>
                  <button onClick={() => { setView('courses'); resetForm(); }} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200"><X className="w-4 h-4"/></button>
                </div>

                {profile?.role === 'teacher' ? (
                  <>
                    <div className="space-y-6 max-w-lg mx-auto mb-10">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Título del Curso</label>
                          <input value={newCourseTitle} onChange={e => setNewCourseTitle(e.target.value)} className="w-full px-4 py-3 rounded-xl border dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow" placeholder="Ej: Cálculo Avanzado I"/>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Categoría</label>
                          <div className="grid grid-cols-2 gap-3">
                            {['math', 'programming', 'letters', 'other'].map((cat: any) => (
                              <button key={cat} onClick={() => setNewCourseCategory(cat)} className={`p-3 rounded-xl border text-sm font-bold capitalize transition-all flex items-center justify-center gap-2 ${newCourseCategory === cat ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                {cat === 'math' ? <Calculator className="w-4 h-4"/> : cat === 'programming' ? <Terminal className="w-4 h-4"/> : cat === 'letters' ? <Feather className="w-4 h-4"/> : <Book className="w-4 h-4"/>}
                                {cat === 'math' ? 'Matemáticas' : cat === 'letters' ? 'Letras' : cat === 'programming' ? 'Programación' : 'Otros'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Descripción</label>
                          <textarea value={newCourseDesc} onChange={e => setNewCourseDesc(e.target.value)} className="w-full px-4 py-3 rounded-xl border h-32 resize-none dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="¿De qué trata este curso?"/>
                        </div>
                        
                        <div className="flex gap-4">
                            {editingCourseId && (
                                <button onClick={resetForm} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
                                    <Ban className="w-5 h-5"/> Cancelar
                                </button>
                            )}
                            <button onClick={createOrUpdateCourse} disabled={!newCourseTitle || !newCourseDesc} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-indigo-500/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2">
                                {editingCourseId ? <><Save className="w-5 h-5"/> Guardar Cambios</> : 'Publicar Curso'}
                            </button>
                        </div>
                    </div>

                    {/* VISTA EXPLORE PARA PROFESORES (PARA QUE VEAN LOS CURSOS EXISTENTES) */}
                    <div className="pt-8 border-t dark:border-gray-700">
                      <h3 className="font-bold text-lg mb-4 text-gray-500 dark:text-gray-400">Todos los Cursos en la Plataforma ({courses.length})</h3>
                      <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
                        {courses.length === 0 && <p className="text-gray-400 text-sm italic">No se encontraron cursos.</p>}
                        {courses.map(c => (
                            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-10 rounded-full ${c.category === 'math' ? 'bg-blue-500' : c.category === 'programming' ? 'bg-black dark:bg-white' : c.category === 'letters' ? 'bg-amber-500' : 'bg-indigo-500'}`}></div>
                                <div>
                                  <h4 className="font-bold text-sm dark:text-gray-200">{c.title}</h4>
                                  <p className="text-xs text-gray-500">{c.profiles?.full_name || 'Desconocido'}</p>
                                </div>
                              </div>
                              {c.created_by === user.id && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">Mío</span>}
                            </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {courses.length === 0 && <div className="col-span-2 text-center py-10 text-gray-400 italic">No hay nuevos cursos disponibles por ahora.</div>}
                      {courses.map(c => (
                         <div key={c.id} className="border dark:border-gray-700 p-5 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all flex justify-between items-center group">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`w-2 h-2 rounded-full ${c.category === 'math' ? 'bg-blue-500' : c.category === 'programming' ? 'bg-black dark:bg-white' : c.category === 'letters' ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
                                <span className="text-xs uppercase font-bold text-gray-400 tracking-wide">{c.category}</span>
                              </div>
                              <h3 className="font-bold text-lg dark:text-white group-hover:text-indigo-600 transition-colors">{c.title}</h3>
                              <p className="text-sm text-gray-500 line-clamp-1 max-w-[250px]">{c.description}</p>
                              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1"><User className="w-3 h-3"/> {c.profiles?.full_name || 'Profesor'}</p>
                            </div>
                            <button onClick={async () => {
                              try {
                                const { error } = await supabase.from('enrollments').insert({ student_id: user.id, course_id: c.id });
                                if (error) throw error;
                                fetchCourses('student', user.id); 
                                setView('courses');
                              } catch(e: any) { alert("Error al inscribirse: " + e.message) }
                            }} className="px-5 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-sm hover:bg-indigo-600 hover:text-white transition-all shadow-sm">Inscribirse</button>
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