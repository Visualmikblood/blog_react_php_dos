import React, { useState, useEffect, useRef, useCallback, createContext, useContext, useMemo } from 'react';
import {
  Plus, Edit3, Save, X, Eye, Image, Bold, Italic, Link, List,
  Hash, Quote, Code, Upload, Calendar, User, Tag, Folder,
  Settings, Trash2, Search, Filter, MoreVertical, Check,
  AlertCircle, FileText, BarChart3, Users, MessageSquare, LogIn, LogOut,
  Home, BookOpen, Clock, ArrowLeft, Moon, Sun
} from 'lucide-react';
import { authAPI, postsAPI, categoriesAPI, dashboardAPI, uploadAPI, commentsAPI, usersAPI, settingsAPI, publicAPI, API_BASE_URL } from './api';

// Contexto del tema
const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Cargar preferencia del localStorage
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    // Guardar preferencia en localStorage
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));

    // Aplicar clase al elemento raíz
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const AdminPanel = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const [currentView, setCurrentView] = useState('welcome');
  const [isPublicView, setIsPublicView] = useState(false);
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [currentPostId, setCurrentPostId] = useState(null);
  const [currentPost, setCurrentPost] = useState(null);

  const [filteredPosts, setFilteredPosts] = useState([]);
  const [selectedPosts, setSelectedPosts] = useState([]);

  // Estados para comentarios
  const [selectedComments, setSelectedComments] = useState([]);

  // Ya no necesitamos editorPost separado, usamos solo editorForm

  // Estados del editor de texto
  const [editorMode, setEditorMode] = useState('visual'); // visual, markdown, preview
  const [selectedText, setSelectedText] = useState('');
  const [saveStatus, setSaveStatus] = useState(''); // '', 'saving', 'saved', 'error'

  // Estados de login
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  // Estados del formulario del editor
  const [editorForm, setEditorForm] = useState({
    id: null,
    title: '',
    excerpt: '',
    content: '',
    category_id: '',
    status: 'draft',
    featured_image: '',
    tags: []
  });

  const [editorLocalForm, setEditorLocalForm] = useState({
    title: '',
    content: '',
    excerpt: '',
    category_id: '',
    status: 'draft',
    featured_image: '',
    tags: []
  });

  const setEditorLocalFormCallback = useCallback((updater) => {
    setEditorLocalForm(updater);
  }, []);

  // Estados de filtros y búsqueda
  const [postsFilters, setPostsFilters] = useState({
    search: '',
    category: '',
    status: '',
    date_from: '',
    date_to: '',
    page: 1,
    limit: 10
  });


  // Estados para comentarios, usuarios y configuración
  const [comments, setComments] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    // Verificar si ya hay un token guardado
    const token = localStorage.getItem('auth_token');
    if (token) {
      verifyToken(token);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && (postsFilters.page !== 1 || postsFilters.category || postsFilters.status || postsFilters.search || postsFilters.date_from || postsFilters.date_to)) {
      loadPostsWithFilters();
    } else {
      setFilteredPosts(posts.slice(0, 10));
    }
    // Limpiar selección cuando cambian los filtros
    setSelectedPosts([]);
  }, [postsFilters.page, postsFilters.category, postsFilters.status, postsFilters.search, postsFilters.date_from, postsFilters.date_to, isAuthenticated, posts]);


  // Funciones de autenticación
  const verifyToken = async (token) => {
    try {
      const response = await authAPI.verifyToken(token);
      if (response.valid) {
        setIsAuthenticated(true);
        setUser(response.user);
        setCurrentView('dashboard');
      } else {
        localStorage.removeItem('auth_token');
        setCurrentView('login');
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      localStorage.removeItem('auth_token');
      setCurrentView('login');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await authAPI.login(loginData);

      if (response.token) {
        localStorage.setItem('auth_token', response.token);
        setIsAuthenticated(true);
        setUser(response.user);
        setCurrentView('dashboard');
        showNotification('Inicio de sesión exitoso');
      } else {
        showNotification(response.message || 'Error en el inicio de sesión', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      showNotification('Error al iniciar sesión: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    setUser(null);
    setCurrentView('login');
    showNotification('Sesión cerrada exitosamente');
  };

  // Funciones de carga de datos
  const loadInitialData = async () => {
    try {
      // Cargar posts
      const postsResponse = await postsAPI.getAll({ limit: 1000 });
      if (postsResponse.posts) {
        // Formatear posts para el frontend
        const formattedPosts = postsResponse.posts.map(post => ({
          ...post,
          date: new Date(post.created_at).toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          category: post.category_name || 'Sin categoría'
        }));
        setPosts(formattedPosts);
      }

      // Cargar categorías
      const categoriesResponse = await categoriesAPI.getAll();
      if (categoriesResponse.categories) {
        setCategories(categoriesResponse.categories);
      } else {
        // Cargar categorías de ejemplo si falla la API
        setCategories([
          { id: 1, name: 'Tecnología', slug: 'tecnologia', post_count: 2 },
          { id: 2, name: 'Diseño', slug: 'diseno', post_count: 0 },
          { id: 3, name: 'Marketing', slug: 'marketing', post_count: 0 },
          { id: 4, name: 'Tutoriales', slug: 'tutoriales', post_count: 0 }
        ]);
      }

      // Cargar estadísticas del dashboard
      const statsResponse = await dashboardAPI.getStats();
      if (statsResponse.stats) {
        setDashboardStats(statsResponse.stats);
      } else {
        // Estadísticas de ejemplo
        setDashboardStats({
          total_posts: posts.length,
          total_views: 2140,
          total_likes: 38,
          total_comments: 38,
          total_categories: 4,
          total_authors: 2
        });
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      showNotification('Error al cargar los datos - usando datos de ejemplo', 'error');
      // Cargar datos de ejemplo si falla la API
      loadSampleData();
    }
  };

  const loadPostsWithFilters = async () => {
    setIsLoading(true);
    try {
      const response = await postsAPI.getAll(postsFilters);
      if (response.posts) {
        const formattedPosts = response.posts.map(post => ({
          ...post,
          date: new Date(post.created_at).toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          category: post.category_name || 'Sin categoría'
        }));
        setFilteredPosts(formattedPosts);
      }
    } catch (error) {
      console.error('Error loading posts with filters:', error);
      showNotification('Error al cargar artículos', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSampleData = () => {
    const samplePosts = [
      {
        id: 1,
        title: 'Bienvenido a ModernBlog',
        excerpt: 'Primer artículo de bienvenida al blog ModernBlog',
        content: '# Bienvenido a ModernBlog\n\n¡Hola! Este es el primer artículo de nuestro blog moderno.',
        category: 'Tecnología',
        author: 'Administrador',
        date: '2024-01-15',
        status: 'published',
        views: 120,
        likes: 15,
        comments: 4,
        featured_image: '',
        tags: ['React', 'PHP', 'Blog']
      },
      {
        id: 2,
        title: 'Guía completa de React Hooks',
        excerpt: 'Guía completa sobre React Hooks y su uso práctico',
        content: '# Guía completa de React Hooks\n\nLos React Hooks revolucionaron la forma en que escribimos componentes.',
        category: 'Tecnología',
        author: 'Autor Demo',
        date: '2024-01-10',
        status: 'published',
        views: 200,
        likes: 25,
        comments: 8,
        featured_image: '',
        tags: ['React', 'JavaScript', 'Desarrollo Web']
      }
    ];

    const sampleCategories = [
      { id: 1, name: 'Tecnología', slug: 'tecnologia', post_count: 2 },
      { id: 2, name: 'Diseño', slug: 'diseno', post_count: 0 },
      { id: 3, name: 'Marketing', slug: 'marketing', post_count: 0 },
      { id: 4, name: 'Tutoriales', slug: 'tutoriales', post_count: 0 }
    ];

    setPosts(samplePosts);
    setCategories(sampleCategories);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSavePost = async () => {
    setIsLoading(true);
    try {
      if (editorForm.id) {
        // Actualizar post existente
        await postsAPI.update(editorForm);
        showNotification('Artículo actualizado exitosamente');
      } else {
        // Crear nuevo post
        const postData = { ...localForm };

        await postsAPI.create(postData);
        showNotification('Artículo creado exitosamente');
      }

      // Recargar posts después de guardar
      await loadInitialData();
      setCurrentView('posts');
    } catch (error) {
      console.error('Error saving post:', error);
      showNotification('Error al guardar el artículo: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewPost = useCallback(() => {
    setEditorForm({ id: null });
    setEditorLocalForm({
      title: '',
      content: '',
      excerpt: '',
      category_id: '',
      status: 'draft',
      featured_image: '',
      tags: []
    });
    setCurrentView('editor');
  }, []);

  const handleEditPost = async (post) => {
    setIsLoading(true);
    try {
      // Usar datos del admin como base
      let editForm = {
        id: post.id,
        title: post.title || '',
        content: post.content || '',
        excerpt: post.excerpt || '',
        category_id: categories.find(c => c.name === post.category)?.id || '',
        featured_image: post.featured_image || '',
        tags: Array.isArray(post.tags) ? post.tags : [],
        status: post.status || 'draft'
      };

      // Intentar cargar contenido completo desde API pública si está disponible
      try {
        const response = await publicAPI.getPostById(post.id);
        if (response.post && response.post.content) {
          // Sobrescribir con contenido completo si está disponible
          editForm.content = response.post.content;
          editForm.title = response.post.title || editForm.title;
          editForm.excerpt = response.post.excerpt || editForm.excerpt;
          editForm.featured_image = response.post.featured_image || editForm.featured_image;
          editForm.tags = Array.isArray(response.post.tags) ? response.post.tags : editForm.tags;
        }
      } catch (error) {
        // Si falla la API pública, usar datos del admin (ya preparados arriba)
        console.log('Usando datos del admin para edición');
      }

      setEditorForm({ id: post.id });
      setEditorLocalForm(editForm);
      setCurrentView('editor');
    } catch (error) {
      console.error('Error loading post for edit:', error);
      // Fallback: usar datos del admin si falla la API
      const editForm = {
        id: post.id,
        title: post.title || '',
        content: post.content || '',
        excerpt: post.excerpt || '',
        category_id: categories.find(c => c.name === post.category)?.id || '',
        featured_image: post.featured_image || '',
        tags: post.tags || [],
        status: post.status || 'draft'
      };
      setEditorLocalForm(editForm);
      setCurrentView('editor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este artículo? Esta acción no se puede deshacer.')) return;

    setIsLoading(true);
    try {
      await postsAPI.delete(postId);
      showNotification('Artículo eliminado exitosamente');
      await loadInitialData();
    } catch (error) {
      console.error('Error deleting post:', error);
      showNotification('Error al eliminar el artículo', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    await loadPostsWithFilters();
  };

  const handleFilterChange = (filterType, value) => {
    setPostsFilters(prev => ({ ...prev, [filterType]: value }));
  };

  const clearFilters = () => {
    setPostsFilters({
      search: '',
      category: '',
      status: '',
      date_from: '',
      date_to: '',
      page: 1,
      limit: 10
    });
    setFilteredPosts([]);
  };

  // Funciones para selección múltiple
  const handleSelectPost = (postId) => {
    setSelectedPosts(prev =>
      prev.includes(postId)
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    );
  };

  const handleSelectAll = () => {
    const currentPosts = (filteredPosts.length > 0 ? filteredPosts : posts).map(post => post.id);
    setSelectedPosts(prev =>
      prev.length === currentPosts.length ? [] : currentPosts
    );
  };

  const handleBulkDelete = async () => {
    if (selectedPosts.length === 0) return;
    if (!confirm(`¿Estás seguro de que quieres eliminar ${selectedPosts.length} artículo(s)? Esta acción no se puede deshacer.`)) return;

    setIsLoading(true);
    try {
      for (const postId of selectedPosts) {
        await postsAPI.delete(postId);
      }
      showNotification(`${selectedPosts.length} artículo(s) eliminado(s) exitosamente`);
      setSelectedPosts([]);
      await loadInitialData();
    } catch (error) {
      console.error('Error bulk deleting posts:', error);
      showNotification('Error al eliminar artículos', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedPosts.length === 0) return;

    setIsLoading(true);
    try {
      for (const postId of selectedPosts) {
        await postsAPI.update({ id: postId, status: newStatus });
      }
      showNotification(`${selectedPosts.length} artículo(s) actualizado(s) a ${newStatus === 'published' ? 'Publicado' : 'Borrador'}`);
      setSelectedPosts([]);
      await loadInitialData();
    } catch (error) {
      console.error('Error bulk updating posts:', error);
      showNotification('Error al actualizar artículos', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Funciones para selección múltiple de comentarios
  const handleSelectComment = (commentId) => {
    setSelectedComments(prev =>
      prev.includes(commentId)
        ? prev.filter(id => id !== commentId)
        : [...prev, commentId]
    );
  };


  const handleBulkDeleteComments = async (reloadComments) => {
    if (selectedComments.length === 0) return;
    if (!confirm(`¿Estás seguro de que quieres eliminar ${selectedComments.length} comentario(s)? Esta acción no se puede deshacer.`)) return;

    setIsLoading(true);
    try {
      await commentsAPI.bulkDelete(selectedComments);
      showNotification(`${selectedComments.length} comentario(s) eliminado(s) exitosamente`);
      setSelectedComments([]);
      if (reloadComments) reloadComments();
    } catch (error) {
      console.error('Error bulk deleting comments:', error);
      showNotification('Error al eliminar comentarios', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkStatusChangeComments = async (newStatus, reloadComments) => {
    if (selectedComments.length === 0) return;

    setIsLoading(true);
    try {
      const updates = selectedComments.map(id => ({ id, status: newStatus }));
      await commentsAPI.bulkUpdate(updates);
      showNotification(`${selectedComments.length} comentario(s) actualizado(s) a ${newStatus === 'approved' ? 'Aprobado' : newStatus === 'pending' ? 'Pendiente' : 'Rechazado'}`);
      setSelectedComments([]);
      if (reloadComments) reloadComments();
    } catch (error) {
      console.error('Error bulk updating comments:', error);
      showNotification('Error al actualizar comentarios', 'error');
    } finally {
      setIsLoading(false);
    }
  };


  const formatText = (type) => {
    const textarea = contentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = localForm.content.substring(start, end);

    let before = '', after = '';
    switch (type) {
      case 'bold':
        before = '**';
        after = '**';
        break;
      case 'italic':
        before = '*';
        after = '*';
        break;
      case 'heading':
        before = '## ';
        break;
      case 'link':
        before = '[';
        after = '](url)';
        break;
      case 'list':
        before = '- ';
        break;
      case 'quote':
        before = '> ';
        break;
      case 'code':
        before = '`';
        after = '`';
        break;
    }

    const newText = before + selectedText + after;
    const newContent = content.substring(0, start) + newText + content.substring(end);

    // Actualizar el estado local
    setContent(newContent);

    // Restaurar posición del cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const generatePreview = () => {
    if (!content) return '<p class="text-gray-500 italic">La vista previa aparecerá aquí...</p>';

    // Agregar imagen destacada si existe
    let html = '';
    if (localForm.featured_image) {
      const imgSrc = localForm.featured_image.startsWith('http') || localForm.featured_image.startsWith('blob:') ? localForm.featured_image : `${API_BASE_URL}${localForm.featured_image}`;
      html += `<img src="${imgSrc}" alt="Imagen destacada" class="w-full h-64 object-cover rounded-lg mb-6 shadow-md" />`;
    }

    // Convertir Markdown básico a HTML con mejor formato
    html += content
      // Headers
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-6 mb-3 text-gray-800 border-b border-gray-200 pb-1">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-8 mb-4 text-gray-900">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-10 mb-6 text-gray-900 border-b-2 border-blue-500 pb-2">$1</h1>')

      // Texto formateado
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-red-600">$1</code>')
      .replace(/```([^`]+)```/g, '<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code class="text-sm font-mono text-red-600">$1</code></pre>')

      // Blockquotes
      .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-blue-500 pl-4 my-4 text-gray-700 italic bg-blue-50 py-2">$1</blockquote>')

      // Listas
      .replace(/^- (.*$)/gm, '<li class="ml-6 mb-1">• $1</li>')
      .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-6 mb-1">$1. $2</li>')

      // Enlaces e imágenes
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        const fullSrc = src.startsWith('http') || src.startsWith('blob:') ? src : `${API_BASE_URL}${src}`;
        return `<img src="${fullSrc}" alt="${alt}" class="max-w-full h-auto rounded-lg shadow-md my-4" />`;
      })

      // Párrafos
      .replace(/\n\n/g, '</p><p class="mb-4 leading-relaxed">')
      .replace(/\n/g, '<br>');

    // Envolver en contenedor con estilos
    return `
      <div class="prose prose-lg max-w-none">
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p class="mb-4 leading-relaxed text-gray-800">${html}</p>
        </div>
      </div>
    `;
  };

  // Componente de Notificación
  const Notification = () => (
    notification && (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
        notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'
      } text-white`}>
        <div className="flex items-center gap-2">
          {notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Check className="w-5 h-5" />}
          {notification.message}
        </div>
      </div>
    )
  );

  // Vista Dashboard
  const Dashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{posts.length}</h3>
              <p className="text-gray-600 dark:text-gray-400">Total Artículos</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Eye className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{posts.reduce((total, post) => total + (post.views || 0), 0)}</h3>
              <p className="text-gray-600 dark:text-gray-400">Vistas Totales</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{posts.reduce((total, post) => total + (post.comments || 0), 0)}</h3>
              <p className="text-gray-600 dark:text-gray-400">Comentarios</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Folder className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{categories.length}</h3>
              <p className="text-gray-600 dark:text-gray-400">Categorías</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">Artículos Recientes</h3>
        <div className="space-y-4">
          {posts.slice(0, 5).map(post => (
            <div key={post.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-800 dark:text-gray-200">{post.title}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{post.category} • {post.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  post.status === 'published' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400'
                }`}>
                  {post.status === 'published' ? 'Publicado' : 'Borrador'}
                </span>
                <button
                  onClick={() => {
                    setCurrentPost(null); // Limpiar post anterior para forzar carga
                    setIsPublicView(true);
                    setCurrentPostId(post.id);
                  }}
                  className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                  title="Ver artículo"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => handleEditPost(post)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300" disabled={isLoading}>
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeletePost(post.id)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                  title="Eliminar artículo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Vista Lista de Posts
  const PostsList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button
          onClick={handleNewPost}
          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo Artículo
        </button>

        {selectedPosts.length > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{selectedPosts.length}</span>
              </div>
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                artículo(s) seleccionado(s)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkStatusChange('published')}
                disabled={isLoading}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                <Check className="w-4 h-4" />
                Publicar
              </button>
              <button
                onClick={() => handleBulkStatusChange('draft')}
                disabled={isLoading}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                <Edit3 className="w-4 h-4" />
                Borrador
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isLoading}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar artículos..."
                defaultValue={postsFilters.search}
                onBlur={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              />
            </div>
            <select
              defaultValue={postsFilters.category}
              onBlur={(e) => handleFilterChange('category', e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
            >
              <option value="">Todas las categorías</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
            <select
              defaultValue={postsFilters.status}
              onBlur={(e) => handleFilterChange('status', e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
            >
              <option value="">Todos los estados</option>
              <option value="published">Publicado</option>
              <option value="draft">Borrador</option>
            </select>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Desde:</label>
              <input
                type="date"
                defaultValue={postsFilters.date_from}
                onBlur={(e) => handleFilterChange('date_from', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Hasta:</label>
              <input
                type="date"
                defaultValue={postsFilters.date_to}
                onBlur={(e) => handleFilterChange('date_to', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? 'Buscando...' : 'Buscar'}
            </button>
            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Limpiar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600">
                  <th className="w-12 py-3 px-4 text-gray-800 dark:text-gray-200">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={(filteredPosts.length > 0 ? filteredPosts : posts).every(post => selectedPosts.includes(post.id))}
                        ref={(el) => {
                          if (el) {
                            const currentPosts = filteredPosts.length > 0 ? filteredPosts : posts;
                            const selectedCount = currentPosts.filter(post => selectedPosts.includes(post.id)).length;
                            el.indeterminate = selectedCount > 0 && selectedCount < currentPosts.length;
                          }
                        }}
                        onChange={handleSelectAll}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 focus:ring-2 border-2 border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer"
                      />
                      <span className="ml-2 text-sm font-medium hidden sm:inline">Todos</span>
                    </div>
                  </th>
                  <th className="w-16 text-left py-3 px-4 text-gray-800 dark:text-gray-200">N°</th>
                  <th className="w-80 text-left py-3 px-4 text-gray-800 dark:text-gray-200">Título</th>
                  <th className="w-32 text-left py-3 px-4 text-gray-800 dark:text-gray-200">Estado</th>
                  <th className="w-40 text-left py-3 px-4 text-gray-800 dark:text-gray-200">Fecha</th>
                  <th className="w-52 text-left py-3 px-4 text-gray-800 dark:text-gray-200">Estadísticas</th>
                  <th className="w-32 text-left py-3 px-4 text-gray-800 dark:text-gray-200">Categoría</th>
                  <th className="w-40 text-left py-3 px-4 text-gray-800 dark:text-gray-200">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(filteredPosts.length > 0 ? filteredPosts : posts).map((post, index) => (
                  <tr
                    key={post.id}
                    className={`border-b border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedPosts.includes(post.id) ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''
                    }`}
                  >
                    <td className="w-12 py-4 px-4">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedPosts.includes(post.id)}
                          onChange={() => handleSelectPost(post.id)}
                          className="h-5 w-5 text-blue-600 focus:ring-blue-500 focus:ring-2 border-2 border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer checked:bg-blue-600 checked:border-blue-600"
                        />
                      </div>
                    </td>
                    <td className="w-16 py-4 px-4 text-center text-gray-600 dark:text-gray-400 font-medium">
                      {(postsFilters.page - 1) * postsFilters.limit + index + 1}
                    </td>
                    <td className="w-80 py-4 px-4">
                      <div>
                        <h4 className="font-medium text-gray-800 dark:text-gray-200 truncate" title={post.title}>{post.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate" title={post.excerpt}>{post.excerpt}</p>
                      </div>
                    </td>
                    <td className="w-32 py-4 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs truncate ${
                        post.status === 'published' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400'
                      }`}>
                        {post.status === 'published' ? 'Publicado' : 'Borrador'}
                      </span>
                    </td>
                    <td className="w-40 py-4 px-4 text-sm text-gray-600 dark:text-gray-400 truncate" title={post.date}>
                      {post.date}
                    </td>
                    <td className="w-52 py-4 px-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{post.views} vistas</span>
                        <span className="truncate">{post.likes} likes</span>
                        <span className="truncate">{post.comments} comentarios</span>
                      </div>
                    </td>
                    <td className="w-32 py-4 px-4">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded-full text-sm truncate" title={post.category}>
                        {post.category}
                      </span>
                    </td>
                    <td className="w-40 py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCurrentPost(null); // Limpiar post anterior para forzar carga
                            setIsPublicView(true);
                            setCurrentPostId(post.id);
                          }}
                          className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                          title="Ver artículo"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditPost(post)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          disabled={isLoading}
                          title="Editar artículo"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          title="Eliminar artículo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {filteredPosts.length > 0 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => setPostsFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={postsFilters.page === 1}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-gray-700 dark:text-gray-300">
                Página {postsFilters.page}
              </span>
              <button
                onClick={() => setPostsFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={filteredPosts.length < postsFilters.limit}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Funciones de actualización del editor (memoizadas para evitar re-renders)
  const updateEditorField = useCallback((field, value) => {
    setEditorForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateEditorForm = useCallback((updates) => {
    setEditorForm(prev => ({ ...prev, ...updates }));
  }, []);


  // Editor de Artículos
  const ArticleEditor = React.memo(({ localForm, setLocalForm }) => {

      const titleRef = useRef(null);
      const excerptRef = useRef(null);
      const contentRef = useRef(null);
      const imageUploadRef = useRef(null);
      const tagsRef = useRef(null);

      const [title, setTitle] = useState(localForm.title || '');
      const [excerpt, setExcerpt] = useState(localForm.excerpt || '');
      const [content, setContent] = useState(localForm.content || '');

      useEffect(() => {
        setTitle(localForm.title || '');
      }, [localForm.title]);

      useEffect(() => {
        setExcerpt(localForm.excerpt || '');
      }, [localForm.excerpt]);

      useEffect(() => {
        setContent(localForm.content || '');
      }, [localForm.content]);

      const featuredImageRef = useRef(localForm.featured_image);

      useEffect(() => {
        featuredImageRef.current = localForm.featured_image;
      }, [localForm.featured_image]);

      const handleTagsChange = useCallback(() => {
        if (tagsRef.current) {
          const tags = tagsRef.current.value.split(',').map(tag => tag.trim()).filter(tag => tag);
          setLocalForm(prev => ({ ...prev, tags }));
        }
      }, []);

      const wordCount = useMemo(() => {
        const text = content || '';
        if (text.trim() === '') return 0;
        const words = text.match(/\b\w+\b/g);
        return words ? words.length : 0;
      }, [content]);

    const handleImageButtonClick = useCallback(() => {
      imageUploadRef.current?.click();
    }, []);

    const handleImageUpload = useCallback(async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      console.log('handleImageUpload - file selected:', file.name, 'type:', file.type, 'size:', file.size);

      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        showNotification('Por favor selecciona un archivo de imagen válido', 'error');
        return;
      }

      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showNotification('La imagen es demasiado grande. Máximo 5MB', 'error');
        return;
      }

      // Mostrar vista previa local inmediatamente
      const previewUrl = URL.createObjectURL(file);
      console.log('handleImageUpload - setting local preview:', previewUrl);
      // No actualizar localForm con preview para evitar re-renders

      setIsLoading(true);
      try {
        const formData = new FormData();
        formData.append('image', file);

        console.log('Subiendo imagen...');
        const response = await uploadAPI.uploadImage(formData);
        console.log('Imagen subida exitosamente:', response.image_url);

        // Reemplazar la vista previa local con la URL del servidor
        URL.revokeObjectURL(previewUrl); // Liberar memoria
        console.log('handleImageUpload - replacing with server URL:', response.image_url);
        setLocalForm(prev => {
          const newForm = { ...prev, featured_image: response.image_url };
          console.log('handleImageUpload - localForm updated to:', newForm);
          return newForm;
        });
        // Actualizar la ref y localStorage inmediatamente
        featuredImageRef.current = response.image_url;
        localStorage.setItem('temp_featured_image', response.image_url);
        console.log('handleImageUpload - featuredImageRef updated to:', response.image_url);

        showNotification('Imagen subida exitosamente');
      } catch (error) {
        console.error('Error uploading image:', error);
        showNotification('Error al subir la imagen: ' + error.message, 'error');

        // Si falla la subida, quitar la vista previa
        URL.revokeObjectURL(previewUrl);
      } finally {
        setIsLoading(false);
      }
    }, []);

    const handleSavePost = async () => {
      console.log('handleSavePost - localForm at start:', localForm);
      console.log('handleSavePost - localForm.featured_image at start:', localForm.featured_image);

      // Obtener valores actuales del estado local
      const currentTitle = title || '';
      const currentExcerpt = excerpt || '';
      const currentContent = content || '';

      // Validación básica
      if (!currentTitle || currentTitle.trim() === '') {
        showNotification('El título es obligatorio', 'error');
        return;
      }

      if (!currentContent || currentContent.trim() === '') {
        showNotification('El contenido es obligatorio', 'error');
        return;
      }

      setSaveStatus('saving');
      setIsLoading(true);

      try {
        // Obtener imagen de localStorage o ref
        const tempImage = localStorage.getItem('temp_featured_image');
        const finalImage = tempImage || featuredImageRef.current || '';

        const postData = {
          title: currentTitle.trim(),
          excerpt: currentExcerpt ? currentExcerpt.trim() : '',
          content: currentContent.trim(),
          category_id: editorLocalForm.category_id || null,
          status: editorLocalForm.status || 'draft',
          featured_image: finalImage,
          tags: Array.isArray(editorLocalForm.tags) ? editorLocalForm.tags.filter(tag => tag.trim() !== '') : []
        };

        console.log('handleSavePost - Datos a enviar:', postData);
        console.log('handleSavePost - tempImage:', tempImage);
        console.log('handleSavePost - featuredImageRef.current:', featuredImageRef.current);
        console.log('handleSavePost - finalImage:', finalImage);

        // Limpiar localStorage después de usarlo
        if (tempImage) {
          localStorage.removeItem('temp_featured_image');
        }

        if (editorForm.id) {
          // Actualizar post existente
          postData.id = editorForm.id;
          console.log('Actualizando post existente con ID:', postData.id);
          await postsAPI.update(postData);
          setSaveStatus('saved');
          showNotification('Artículo actualizado exitosamente');
        } else {
          // Crear nuevo post
          console.log('Creando nuevo post');
          await postsAPI.create(postData);
          setSaveStatus('saved');
          showNotification('Artículo creado exitosamente');
        }

        // Recargar posts
        await loadInitialData();
        setCurrentView('posts');

        // Limpiar estado después de 2 segundos
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (error) {
        console.error('Error saving post:', error);
        setSaveStatus('error');
        showNotification('Error al guardar el artículo: ' + error.message, 'error');
        setTimeout(() => setSaveStatus(''), 3000);
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-end items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView('posts')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <X className="w-4 h-4 mr-2 inline" />
              Cancelar
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={handleSavePost}
                disabled={isLoading}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isLoading ? 'Guardando...' : 'Guardar'}
              </button>

              {saveStatus && (
                <div className={`flex items-center gap-2 text-sm ${
                  saveStatus === 'saving' ? 'text-blue-600 dark:text-blue-400' :
                  saveStatus === 'saved' ? 'text-green-600 dark:text-green-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {saveStatus === 'saving' && <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>}
                  {saveStatus === 'saved' && <Check className="w-4 h-4" />}
                  {saveStatus === 'error' && <AlertCircle className="w-4 h-4" />}
                  <span>
                    {saveStatus === 'saving' && 'Guardando...'}
                    {saveStatus === 'saved' && 'Guardado'}
                    {saveStatus === 'error' && 'Error al guardar'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Editor Principal */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
              <div className="space-y-4">
                {/* Título */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Título del Artículo
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => setLocalForm(prev => ({ ...prev, title }))}
                    placeholder="Ingresa el título de tu artículo..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                  />
                </div>

                {/* Excerpt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Resumen/Excerpt
                  </label>
                  <textarea
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    onBlur={() => setLocalForm(prev => ({ ...prev, excerpt }))}
                    placeholder="Breve descripción del artículo..."
                    rows="3"
                    maxLength="160"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                    {(excerpt || '').length}/160 caracteres
                  </div>
                </div>

                {/* Editor Toolbar */}
                <div className="border-b border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-1 mb-4">
                    <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                      <button
                        onClick={() => setEditorMode('visual')}
                        className={`px-3 py-1 rounded text-sm ${
                          editorMode === 'visual' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        Visual
                      </button>
                      <button
                        onClick={() => setEditorMode('markdown')}
                        className={`px-3 py-1 rounded text-sm ${
                          editorMode === 'markdown' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        Markdown
                      </button>
                      <button
                        onClick={() => setEditorMode('preview')}
                        className={`px-3 py-1 rounded text-sm ${
                          editorMode === 'preview' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        Vista Previa
                      </button>
                    </div>

                    {editorMode === 'visual' && (
                      <div className="flex items-center gap-1 ml-4">
                        <button
                          onClick={() => formatText('bold')}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          title="Negrita"
                        >
                          <Bold className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => formatText('italic')}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          title="Cursiva"
                        >
                          <Italic className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => formatText('heading')}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          title="Título"
                        >
                          <Hash className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => formatText('link')}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          title="Enlace"
                        >
                          <Link className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => formatText('list')}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          title="Lista"
                        >
                          <List className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => formatText('quote')}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          title="Cita"
                        >
                          <Quote className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => formatText('code')}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          title="Código"
                        >
                          <Code className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Área de Contenido */}
                <div>
                  {editorMode === 'preview' ? (
                    <div
                      className="min-h-96 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700"
                      dangerouslySetInnerHTML={{ __html: generatePreview() }}
                    />
                  ) : (
                    <textarea
                      ref={contentRef}
                      id="content-editor"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      onBlur={() => setLocalForm(prev => ({ ...prev, content }))}
                      placeholder={editorMode === 'markdown' ?
                        "# Tu artículo aquí...\n\nEscribe en **Markdown** para dar formato a tu contenido.\n\n## Subtítulo\n\nPuedes usar:\n- Listas\n- **Negrita**\n- *Cursiva*\n- `Código`\n- [Enlaces](http://ejemplo.com)" :
                        "Escribe el contenido de tu artículo aquí..."
                      }
                      rows="20"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                    />
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                    {wordCount} palabras | {(content || '').length} caracteres
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Configuración de Publicación */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Publicación</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Estado
                  </label>
                  <select
                    value={localForm.status}
                    onChange={(e) => setLocalForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                  >
                    <option value="draft">Borrador</option>
                    <option value="published">Publicado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Categoría
                  </label>
                  <select
                    value={localForm.category_id}
                    onChange={(e) => setLocalForm(prev => ({ ...prev, category_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                  >
                    <option value="">Seleccionar categoría</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Imagen Destacada */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Imagen Destacada</h3>
              {localForm.featured_image ? (
                <div className="space-y-3">
                  {console.log('About to render image, featured_image:', localForm.featured_image)}
                  <img
                    src={localForm.featured_image.startsWith('http') || localForm.featured_image.startsWith('blob:') ? localForm.featured_image : `${API_BASE_URL}${localForm.featured_image}`}
                    alt="Imagen destacada"
                    className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                    onLoad={() => console.log('Imagen cargada correctamente')}
                    onError={(e) => console.log('Error cargando imagen:', e.target.src)}
                    ref={(img) => { if (img) console.log('Rendering image with src:', img.src); }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleImageButtonClick}
                      className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors flex items-center gap-1"
                      disabled={isLoading}
                    >
                      <Upload className="w-4 h-4" />
                      Cambiar imagen
                    </button>
                    <button
                      onClick={() => {
                        if (localForm.featured_image.startsWith('blob:')) {
                          URL.revokeObjectURL(localForm.featured_image);
                        }
                        setLocalForm(prev => ({ ...prev, featured_image: '' }));
                      }}
                      className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar imagen
                    </button>
                  </div>
                  <input
                    ref={imageUploadRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="text-center">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Arrastra una imagen aquí o selecciona un archivo</p>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleImageButtonClick}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-2 mx-auto"
                        disabled={isLoading}
                      >
                        <Upload className="w-4 h-4" />
                        {isLoading ? 'Subiendo...' : 'Seleccionar archivo'}
                      </button>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2">o</span>
                        <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                      </div>
                      <input
                        type="url"
                        placeholder="Pega la URL de la imagen"
                        value={localForm.featured_image}
                        onChange={(e) => setLocalForm(prev => ({ ...prev, featured_image: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <input
                    ref={imageUploadRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Tags</h3>
              <input
                ref={tagsRef}
                type="text"
                placeholder="Agregar tags separados por comas"
                value={Array.isArray(localForm.tags) ? localForm.tags.join(', ') : ''}
                onChange={(e) => setLocalForm(prev => ({ ...prev, tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              />
            </div>

            {/* SEO */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">SEO</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value="url-generada-automaticamente"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-gray-200"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Meta Descripción
                  </label>
                  <textarea
                    value="Descripción generada automáticamente"
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                    readOnly
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    0/160 caracteres
                  </p>
                </div>
              </div>
            </div>
  
            {/* Paginación */}
            {filteredPosts.length > 0 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={() => setPostsFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={postsFilters.page === 1}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-gray-700 dark:text-gray-300">
                  Página {postsFilters.page}
                </span>
                <button
                  onClick={() => setPostsFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={filteredPosts.length < postsFilters.limit}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  });

  // Vista de Categorías
  const CategoriesView = () => {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [categoryForm, setCategoryForm] = useState({
      name: '',
      description: '',
      icon: ''
    });

    const handleCreateCategory = async (e) => {
      e.preventDefault();
      setIsLoading(true);

      try {
        await categoriesAPI.create(categoryForm);
        showNotification('Categoría creada exitosamente');
        setShowCreateModal(false);
        setCategoryForm({ name: '', description: '', icon: '' });
        await loadInitialData();
      } catch (error) {
        console.error('Error creating category:', error);
        showNotification('Error al crear la categoría', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const handleUpdateCategory = async (e) => {
      e.preventDefault();
      setIsLoading(true);

      try {
        await categoriesAPI.update({ ...categoryForm, id: editingCategory.id });
        showNotification('Categoría actualizada exitosamente');
        setEditingCategory(null);
        setCategoryForm({ name: '', description: '', icon: '' });
        await loadInitialData();
      } catch (error) {
        console.error('Error updating category:', error);
        showNotification('Error al actualizar la categoría', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const handleDeleteCategory = async (categoryId) => {
      if (!confirm('¿Estás seguro de que quieres eliminar esta categoría?')) return;

      setIsLoading(true);
      try {
        await categoriesAPI.delete(categoryId);
        showNotification('Categoría eliminada exitosamente');
        await loadInitialData();
      } catch (error) {
        console.error('Error deleting category:', error);
        showNotification('Error al eliminar la categoría', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const openEditModal = (category) => {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || '',
        icon: category.icon || ''
      });
    };

    const closeModal = () => {
      setShowCreateModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', description: '', icon: '' });
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-start items-center">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nueva Categoría
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(cat => (
              <div key={cat.id} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-md dark:hover:shadow-lg transition-shadow bg-white dark:bg-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {cat.icon && <span className="text-lg">{cat.icon}</span>}
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">{cat.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(cat)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {cat.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{cat.description}</p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-500">{cat.post_count || 0} artículos</p>
              </div>
            ))}
          </div>
        </div>

        {/* Modal para crear/editar categoría */}
        {(showCreateModal || editingCategory) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre de la categoría"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Descripción
                  </label>
                  <textarea
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descripción de la categoría"
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Icono (emoji)
                  </label>
                  <input
                    type="text"
                    value={categoryForm.icon}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, icon: e.target.value }))}
                    placeholder="📁"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                  >
                    {isLoading ? 'Guardando...' : (editingCategory ? 'Actualizar' : 'Crear')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Vista de Comentarios
  const CommentsView = () => {
    const [commentsFilters, setCommentsFilters] = useState({
      status: 'all',
      page: 1,
      limit: 10
    });
    const [commentsData, setCommentsData] = useState([]);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [isLoadingComments, setIsLoadingComments] = useState(false);

    const handleSelectAllComments = () => {
      const currentComments = commentsData.map(comment => comment.id);
      setSelectedComments(prev =>
        prev.length === currentComments.length ? [] : currentComments
      );
    };


    const loadComments = useCallback(async () => {
      if (hasLoaded || isLoadingComments) return; // Evitar carga duplicada

      setIsLoadingComments(true);
      try {
        const response = await commentsAPI.getAll(commentsFilters);
        if (response.comments) {
          setCommentsData(response.comments);
        }
      } catch (error) {
        console.error('Error loading comments:', error);
        showNotification('Error al cargar comentarios', 'error');
        // Cargar datos de ejemplo si falla la API
        const sampleComments = [
          {
            id: 1,
            author_name: 'Juan Pérez',
            author_email: 'juan@email.com',
            content: '¡Excelente artículo! Me encantó la introducción.',
            status: 'approved',
            post_title: 'Bienvenido a ModernBlog',
            created_at: '2024-01-15T10:30:00Z'
          },
          {
            id: 2,
            author_name: 'María García',
            author_email: 'maria@email.com',
            content: '¿Cuándo publicarán más tutoriales?',
            status: 'pending',
            post_title: 'Guía completa de React Hooks',
            created_at: '2024-01-10T14:20:00Z'
          }
        ];
        setCommentsData(sampleComments);
      } finally {
        setIsLoadingComments(false);
        setHasLoaded(true); // Siempre marcar como cargado para evitar bucles
      }
    }, [commentsFilters, hasLoaded, isLoadingComments]);

    useEffect(() => {
      if (!hasLoaded && !isLoadingComments) {
        loadComments();
      }
    }, [commentsFilters, hasLoaded, isLoadingComments]);

    const handleUpdateCommentStatus = async (commentId, newStatus) => {
      setIsLoading(true);
      try {
        await commentsAPI.update({ id: commentId, status: newStatus });
        showNotification('Comentario actualizado exitosamente');
        await loadComments();
      } catch (error) {
        console.error('Error updating comment:', error);
        showNotification('Error al actualizar comentario', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const handleDeleteComment = async (commentId) => {
      if (!confirm('¿Estás seguro de que quieres eliminar este comentario?')) return;

      setIsLoading(true);
      try {
        await commentsAPI.delete(commentId);
        showNotification('Comentario eliminado exitosamente');
        await loadComments();
      } catch (error) {
        console.error('Error deleting comment:', error);
        showNotification('Error al eliminar comentario', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const getStatusColor = (status) => {
      switch (status) {
        case 'approved': return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
        case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400';
        case 'rejected': return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400';
        default: return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400';
      }
    };

    return (
      <div className="space-y-6">
        {selectedComments.length > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{selectedComments.length}</span>
              </div>
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                comentario(s) seleccionado(s)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkStatusChangeComments('approved', loadComments)}
                disabled={isLoading}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                <Check className="w-4 h-4" />
                Aprobar
              </button>
              <button
                onClick={() => handleBulkStatusChangeComments('pending', loadComments)}
                disabled={isLoading}
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                <Clock className="w-4 h-4" />
                Pendiente
              </button>
              <button
                onClick={() => handleBulkStatusChangeComments('rejected', loadComments)}
                disabled={isLoading}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                <X className="w-4 h-4" />
                Rechazar
              </button>
              <button
                onClick={() => handleBulkDeleteComments(loadComments)}
                disabled={isLoading}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={commentsData.length > 0 && selectedComments.length === commentsData.length}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = selectedComments.length > 0 && selectedComments.length < commentsData.length;
                    }
                  }}
                  onChange={handleSelectAllComments}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 focus:ring-2 border-2 border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Seleccionar todos</span>
              </div>
              <select
                value={commentsFilters.status}
                onChange={(e) => {
                  setCommentsFilters(prev => ({ ...prev, status: e.target.value }));
                  setSelectedComments([]); // Limpiar selección al cambiar filtros
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="approved">Aprobados</option>
                <option value="rejected">Rechazados</option>
              </select>
            </div>

            <div className="space-y-4">
              {commentsData.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No hay comentarios para mostrar</p>
                </div>
              ) : (
                commentsData.map(comment => (
                  <div key={comment.id} className={`border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md dark:hover:shadow-lg transition-shadow bg-white dark:bg-gray-700 ${
                    selectedComments.includes(comment.id) ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''
                  }`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedComments.includes(comment.id)}
                          onChange={() => handleSelectComment(comment.id)}
                          className="h-5 w-5 text-blue-600 focus:ring-blue-500 focus:ring-2 border-2 border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-800 dark:text-gray-200">{comment.author_name}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">en</span>
                            <span className="font-medium text-blue-600 dark:text-blue-400">{comment.post_title}</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300 mb-2">{comment.content}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                            <span>{comment.author_email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={comment.status}
                          onChange={(e) => handleUpdateCommentStatus(comment.id, e.target.value)}
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(comment.status)}`}
                        >
                          <option value="pending">Pendiente</option>
                          <option value="approved">Aprobar</option>
                          <option value="rejected">Rechazar</option>
                        </select>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          title="Eliminar comentario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Vista de Usuarios
  const UsersView = () => {
    const [usersFilters, setUsersFilters] = useState({
      role: 'all',
      page: 1,
      limit: 10
    });
    const [usersData, setUsersData] = useState([]);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userForm, setUserForm] = useState({
      name: '',
      email: '',
      password: '',
      role: 'user',
      bio: ''
    });

    const loadUsers = useCallback(async () => {
      if (hasLoaded) return; // Evitar carga duplicada

      try {
        const response = await usersAPI.getAll(usersFilters);
        if (response.users) {
          setUsersData(response.users);
          setHasLoaded(true);
        }
      } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Error al cargar usuarios', 'error');
        // Cargar datos de ejemplo si falla la API
        setUsersData([
          {
            id: 1,
            name: 'Administrador',
            email: 'admin@blog.com',
            role: 'admin',
            bio: 'Administrador del blog ModernBlog',
            posts_count: 2,
            created_at: '2024-01-01T00:00:00Z'
          },
          {
            id: 2,
            name: 'Autor Demo',
            email: 'autor@blog.com',
            role: 'author',
            bio: 'Autor de contenido para el blog',
            posts_count: 1,
            created_at: '2024-01-05T00:00:00Z'
          }
        ]);
        setHasLoaded(true);
      }
    }, [usersFilters, hasLoaded]);

    useEffect(() => {
      if (!hasLoaded) {
        loadUsers();
      }
    }, [loadUsers, hasLoaded, isLoading]);

    const handleCreateUser = async (e) => {
      e.preventDefault();
      setIsLoading(true);

      try {
        await usersAPI.create(userForm);
        showNotification('Usuario creado exitosamente');
        setShowCreateModal(false);
        setUserForm({ name: '', email: '', password: '', role: 'user', bio: '' });
        await loadUsers();
      } catch (error) {
        console.error('Error creating user:', error);
        showNotification('Error al crear usuario', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const handleUpdateUser = async (e) => {
      e.preventDefault();
      setIsLoading(true);

      try {
        await usersAPI.update({ ...userForm, id: editingUser.id });
        showNotification('Usuario actualizado exitosamente');
        setEditingUser(null);
        setUserForm({ name: '', email: '', password: '', role: 'user', bio: '' });
        await loadUsers();
      } catch (error) {
        console.error('Error updating user:', error);
        showNotification('Error al actualizar usuario', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const handleDeleteUser = async (userId) => {
      if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) return;

      setIsLoading(true);
      try {
        await usersAPI.delete(userId);
        showNotification('Usuario eliminado exitosamente');
        await loadUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Error al eliminar usuario', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const openEditModal = (user) => {
      setEditingUser(user);
      setUserForm({
        name: user.name,
        email: user.email,
        password: '', // No mostrar contraseña existente
        role: user.role,
        bio: user.bio || ''
      });
    };

    const closeModal = () => {
      setShowCreateModal(false);
      setEditingUser(null);
      setUserForm({ name: '', email: '', password: '', role: 'user', bio: '' });
    };

    const getRoleColor = (role) => {
      switch (role) {
        case 'admin': return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400';
        case 'author': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400';
        case 'user': return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
        default: return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400';
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-start items-center">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Usuario
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <select
                value={usersFilters.role}
                onChange={(e) => setUsersFilters(prev => ({ ...prev, role: e.target.value }))}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
              >
                <option value="all">Todos los roles</option>
                <option value="admin">Administradores</option>
                <option value="author">Autores</option>
                <option value="user">Usuarios</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-600">
                    <th className="text-left py-3 px-4 text-gray-800 dark:text-gray-200">Usuario</th>
                    <th className="text-left py-3 px-4 text-gray-800 dark:text-gray-200">Rol</th>
                    <th className="text-left py-3 px-4 text-gray-800 dark:text-gray-200">Artículos</th>
                    <th className="text-left py-3 px-4 text-gray-800 dark:text-gray-200">Registro</th>
                    <th className="text-left py-3 px-4 text-gray-800 dark:text-gray-200">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usersData.map(user => (
                    <tr key={user.id} className="border-b border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-4 px-4">
                        <div>
                          <h4 className="font-medium text-gray-800 dark:text-gray-200">{user.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                          {user.bio && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{user.bio}</p>}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          {user.role === 'admin' ? 'Admin' : user.role === 'author' ? 'Autor' : 'Usuario'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {user.posts_count || 0}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal para crear/editar usuario */}
        {(showCreateModal || editingUser) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre completo"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                    required
                  />
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Contraseña *
                    </label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Contraseña"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                      required={!editingUser}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rol
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                  >
                    <option value="user">Usuario</option>
                    <option value="author">Autor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Biografía
                  </label>
                  <textarea
                    value={userForm.bio}
                    onChange={(e) => setUserForm(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Breve descripción del usuario"
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                  >
                    {isLoading ? 'Guardando...' : (editingUser ? 'Actualizar' : 'Crear')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Vista de Configuración
  const SettingsView = () => {
    const [settingsForm, setSettingsForm] = useState({});
    const [settingsData, setSettingsData] = useState({});
    const [hasLoaded, setHasLoaded] = useState(false);
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);

    const loadSettings = useCallback(async () => {
      if (hasLoaded || isLoadingSettings) return; // Evitar carga duplicada

      setIsLoadingSettings(true);
      try {
        const response = await settingsAPI.getAll();
        if (response.settings) {
          setSettingsData(response.settings);
          // Convertir el objeto de settings a formato de formulario
          const formData = {};
          Object.keys(response.settings).forEach(key => {
            formData[key] = { ...response.settings[key] };
          });
          setSettingsForm(formData);
          setHasLoaded(true);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        showNotification('Error al cargar configuración', 'error');
      } finally {
        setIsLoadingSettings(false);
      }
    }, [hasLoaded, isLoadingSettings]);

    useEffect(() => {
      if (!hasLoaded && !isLoadingSettings) {
        loadSettings();
      }
    }, []); // Solo ejecutar una vez al montar el componente

    const handleSettingChange = (key, value) => {
      setSettingsForm(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          value: value
        }
      }));
    };

    const handleSaveSettings = async () => {
      setIsLoading(true);
      try {
        await settingsAPI.update({ settings: settingsForm });
        showNotification('Configuración guardada exitosamente');
        await loadSettings();
      } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Error al guardar configuración', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    const renderSettingInput = (key, setting) => {
      const { value, type, description } = setting;

      switch (type) {
        case 'boolean':
          return (
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={settingsForm[key]?.value === 'true' || settingsForm[key]?.value === true}
                onChange={(e) => handleSettingChange(key, e.target.checked.toString())}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>
          );
        case 'integer':
          return (
            <input
              type="number"
              value={settingsForm[key]?.value || ''}
              onChange={(e) => handleSettingChange(key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
            />
          );
        default:
          return (
            <input
              type="text"
              value={settingsForm[key]?.value || ''}
              onChange={(e) => handleSettingChange(key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
            />
          );
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-start items-center">
          <button
            onClick={handleSaveSettings}
            disabled={isLoading}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="space-y-6">
            {Object.keys(settingsForm).length === 0 ? (
              <div className="text-center py-8">
                <Settings className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Cargando configuración...</p>
              </div>
            ) : (
              Object.entries(settingsForm).map(([key, setting]) => (
                <div key={key} className="border-b border-gray-200 dark:border-gray-600 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                      {setting.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{setting.description}</p>
                      )}
                    </div>
                    <div className="ml-4 w-64">
                      {renderSettingInput(key, setting)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Información</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Los cambios en la configuración se aplicarán inmediatamente después de guardar.
                Algunos cambios pueden requerir recargar la página para verse reflejados.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Vista de Login
  const LoginView = () => {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Panel Admin
            </h1>
            <p className="text-gray-600">Inicia sesión para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo electrónico
              </label>
              <input
                type="email"
                defaultValue={loginData.email}
                onBlur={(e) => setLoginData({ ...loginData, email: e.target.value })}
                placeholder="admin@blog.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                defaultValue={loginData.password}
                onBlur={(e) => setLoginData({ ...loginData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Credenciales por defecto: admin@blog.com / password
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Navegación Sidebar
  const Sidebar = () => {
    const menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
      { id: 'posts', label: 'Artículos', icon: FileText },
      { id: 'categories', label: 'Categorías', icon: Folder },
      { id: 'comments', label: 'Comentarios', icon: MessageSquare },
      { id: 'users', label: 'Usuarios', icon: Users },
      { id: 'settings', label: 'Configuración', icon: Settings },
    ];

    return (
      <div className="w-64 bg-white dark:bg-gray-800 shadow-lg h-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Panel Admin
          </h1>
        </div>
        <nav className="mt-6">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center px-6 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                currentView === item.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-r-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.label}
            </button>
          ))}

          {/* Enlace al blog público */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setIsPublicView(true)}
              className="w-full flex items-center px-6 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
            >
              <BookOpen className="w-5 h-5 mr-3" />
              Ver Blog Público
            </button>
          </div>
        </nav>
      </div>
    );
  };

  // Vista Pública del Blog
  const PublicBlogView = ({ currentPost, setCurrentPost }) => {
    const [publicPosts, setPublicPosts] = useState([]);
    const [publicCategories, setPublicCategories] = useState([]);
    const [publicFilters, setPublicFilters] = useState({
      page: 1,
      limit: 6,
      category: '',
      search: ''
    });
    const loadingPostRef = useRef(null);
    const [isLoadingPublic, setIsLoadingPublic] = useState(false);

    const loadPublicPosts = useCallback(async () => {
      setIsLoadingPublic(true);
      try {
        const response = await publicAPI.getPosts(publicFilters);
        if (response.posts) {
          setPublicPosts(response.posts);
        }
      } catch (error) {
        console.error('Error loading public posts:', error);
      } finally {
        setIsLoadingPublic(false);
      }
    }, [publicFilters]);

    const loadPublicCategories = useCallback(async () => {
      try {
        const response = await publicAPI.getCategories();
        if (response.categories) {
          setPublicCategories(response.categories);
        }
      } catch (error) {
        console.error('Error loading public categories:', error);
      }
    }, []);

    const loadPostById = useCallback(async (postId) => {
      setIsLoadingPublic(true);
      try {
        const response = await publicAPI.getPostById(postId);
        if (response.post) {
          setCurrentPost(response.post);
          // Incrementar vistas cuando se carga el artículo
          try {
            const viewsResponse = await publicAPI.incrementViews(postId);
            if (viewsResponse.views) {
              // Actualizar las vistas en currentPost para mostrar el contador actualizado
              setCurrentPost(prev => ({ ...prev, views: viewsResponse.views }));
            }
          } catch (error) {
            console.error('Error incrementing views:', error);
          }
        }
      } catch (error) {
        console.error('Error loading post:', error);
        showNotification('Error al cargar el artículo', 'error');
      } finally {
        setIsLoadingPublic(false);
      }
    }, []);

    useEffect(() => {
      if (isPublicView) {
        if (currentPost || currentPostId) {
          // Si estamos viendo un post individual, no recargamos la lista
          if (currentPostId && !currentPost && loadingPostRef.current !== currentPostId) {
            loadingPostRef.current = currentPostId;
            loadPostById(currentPostId);
          }
          return;
        }
        loadPublicPosts();
        loadPublicCategories();
      } else {
        loadingPostRef.current = null;
      }
    }, [isPublicView, loadPublicPosts, loadPublicCategories, currentPostId]);

    const handlePublicFilterChange = (filterType, value) => {
      setPublicFilters(prev => ({ ...prev, [filterType]: value, page: 1 }));
    };

    const changePage = (newPage) => {
      if (newPage < 1) return;
      setPublicFilters(prev => ({ ...prev, page: newPage }));
    };

    const viewPost = (postId) => {
      loadPostById(postId);
    };

    const backToBlog = () => {
      setCurrentPost(null);
      setCurrentPostId(null);
      setPublicFilters(prev => ({ ...prev, page: 1 }));
    };

    // Componente para el formulario de comentarios
    const CommentForm = ({ postId, onCommentAdded }) => {
      const [commentData, setCommentData] = useState({
        author_name: '',
        author_email: '',
        content: ''
      });
      const [isSubmitting, setIsSubmitting] = useState(false);

      const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
          console.log('DEBUG: Enviando comentario:', { postId, commentData });
          const response = await publicAPI.createComment(postId, commentData);
          console.log('DEBUG: Respuesta de createComment:', response);
          showNotification('Comentario enviado exitosamente. Está pendiente de aprobación.');
          setCommentData({ author_name: '', author_email: '', content: '' });
          if (onCommentAdded) {
            console.log('DEBUG: Ejecutando onCommentAdded callback');
            onCommentAdded();
          }
        } catch (error) {
          console.error('DEBUG: Error creating comment:', error);
          showNotification('Error al enviar el comentario: ' + error.message, 'error');
        } finally {
          setIsSubmitting(false);
        }
      };

      return (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre *
              </label>
              <input
                type="text"
                value={commentData.author_name}
                onChange={(e) => setCommentData(prev => ({ ...prev, author_name: e.target.value }))}
                placeholder="Tu nombre"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={commentData.author_email}
                onChange={(e) => setCommentData(prev => ({ ...prev, author_email: e.target.value }))}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Comentario *
            </label>
            <textarea
              value={commentData.content}
              onChange={(e) => setCommentData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Escribe tu comentario aquí..."
              rows="4"
              maxLength="1000"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
              {commentData.content.length}/1000 caracteres (mínimo 1)
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-2 disabled:opacity-50 dark:from-blue-600 dark:to-purple-700"
            >
              <MessageSquare className="w-4 h-4" />
              {isSubmitting ? 'Enviando...' : 'Enviar Comentario'}
            </button>
          </div>
        </form>
      );
    };

    if (currentPost) {
      // Vista de artículo individual
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-4xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={backToBlog}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver al blog
                </button>
                <div className="flex items-center gap-2">
                  {/* Botón del tema */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleTheme();
                    }}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                  >
                    {isDarkMode ? (
                      <Sun className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsPublicView(false);
                      setCurrentPost(null);
                      setCurrentPostId(null);
                      setCurrentView('dashboard');
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 dark:from-blue-600 dark:to-purple-700"
                  >
                    Panel Admin
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {currentPost.category}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {currentPost.read_time}
                </span>
                <span>
                  {new Date(currentPost.date).toLocaleString('es-ES', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
              </div>
            </div>
          </header>

          <main className="max-w-4xl mx-auto px-6 py-8">
            {/* Banner para posts en draft */}
            {currentPost.status !== 'published' && (
              <div className="mb-6 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-600 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3" />
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Artículo en borrador</h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">Este artículo no está publicado y solo es visible para administradores.</p>
                  </div>
                </div>
              </div>
            )}

            <article className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
              {currentPost.featured_image && (
                <img
                  src={currentPost.featured_image.startsWith('http') ? currentPost.featured_image : `${API_BASE_URL}${currentPost.featured_image}`}
                  alt={currentPost.title}
                  className="w-full h-64 object-cover"
                  onLoad={() => console.log('Imagen cargada en post individual:', currentPost.featured_image)}
                  onError={(e) => console.log('Error cargando imagen en post individual:', currentPost.featured_image, e)}
                />
              )}
  
              <div className="p-8">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                  {currentPost.title}
                </h1>
  
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-8">
                  <span className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {currentPost.author}
                  </span>
                  <span className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    {currentPost.views || 0} vistas
                  </span>
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    {currentPost.comments_count} comentarios
                  </span>
                </div>

                <div className="prose prose-lg max-w-none dark:prose-invert">
                  {currentPost.content.split('\n').map((paragraph, index) => {
                    if (paragraph.trim() === '') return null;

                    // Convertir Markdown básico a HTML
                    let html = paragraph
                      .replace(/^### (.*$)/gm, '<h3 class="text-xl font-semibold mt-8 mb-4 text-gray-900 dark:text-white">$1</h3>')
                      .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold mt-10 mb-6 text-gray-900 dark:text-white">$1</h2>')
                      .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold mt-12 mb-8 text-gray-900 dark:text-white">$1</h1>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm font-mono">$1</code>')
                      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
                        const fullSrc = src.startsWith('http') || src.startsWith('blob:') ? src : `${API_BASE_URL}${src}`;
                        return `<img src="${fullSrc}" alt="${alt}" class="max-w-full h-auto rounded-lg shadow-md my-4" />`;
                      })
                      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline">$1</a>')
                      .replace(/^- (.*$)/gm, '<li class="ml-6 mb-1 text-gray-700 dark:text-gray-300">• $1</li>')
                      .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-6 mb-1 text-gray-700 dark:text-gray-300">$1. $2</li>');

                    return <p key={index} className="mb-4 leading-relaxed text-gray-800 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: html }} />;
                  })}
                </div>
              </div>
            </article>

            {/* Comentarios */}
            {currentPost.comments && currentPost.comments.length > 0 && (
              <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Comentarios ({currentPost.comments_count})</h3>
                <div className="space-y-6">
                  {currentPost.comments.map(comment => (
                    <div key={comment.id} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-b-0">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">{comment.author_name}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{comment.date}</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{comment.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulario para agregar comentario */}
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Deja tu comentario</h3>
              <CommentForm postId={currentPost.id} onCommentAdded={() => loadPostById(currentPost.id)} />
            </div>
          </main>
        </div>
      );
    }

    // Vista de lista de artículos
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  ModernBlog
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-1">Descubre artículos interesantes sobre tecnología y desarrollo</p>
              </div>
              <div className="flex items-center gap-4">
                {/* Botón del tema */}
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                  {isDarkMode ? (
                    <Sun className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsPublicView(false);
                    setCurrentPostId(null);
                    setCurrentView('dashboard');
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 dark:from-blue-600 dark:to-purple-700"
                >
                  Panel Admin
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar artículos..."
                  value={publicFilters.search}
                  onChange={(e) => handlePublicFilterChange('search', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <select
                value={publicFilters.category}
                onChange={(e) => handlePublicFilterChange('category', e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Todas las categorías</option>
                {publicCategories.map(cat => (
                  <option key={cat.id} value={cat.slug}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {isLoadingPublic ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando artículos...</p>
            </div>
          ) : publicPosts.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">No hay artículos publicados</h3>
              <p className="text-gray-600">Los artículos publicados aparecerán aquí próximamente.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {publicPosts.map(post => (
                <article
                  key={post.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer flex flex-col"
                  onClick={() => viewPost(post.id)}
                >
                  {post.featured_image && (
                    <img
                      src={post.featured_image.startsWith('http') ? post.featured_image : `${API_BASE_URL}${post.featured_image}`}
                      alt={post.title}
                      className="w-full h-48 object-cover"
                      onLoad={() => console.log('Imagen cargada en lista:', post.featured_image)}
                      onError={(e) => console.log('Error cargando imagen en lista:', post.featured_image, e)}
                    />
                  )}

                  <div className="p-6 flex-1 flex flex-col justify-end">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {post.category}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-white">
                        <Clock className="w-3 h-3" />
                        {post.read_time}
                      </span>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 line-clamp-2">
                      {post.title}
                    </h2>

                    <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-3">
                      {post.excerpt}
                    </p>

                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {post.author}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-white">
                        {new Date(post.date).toLocaleString('es-ES', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <MessageSquare className="w-4 h-4" />
                        {post.comments_count}
                      </span>
                      <span
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium cursor-pointer"
                        onClick={() => viewPost(post.id)}
                      >
                        Leer más →
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Paginación */}
          {publicPosts.length > 0 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => changePage(publicFilters.page - 1)}
                disabled={publicFilters.page === 1}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-gray-700 dark:text-gray-300">
                Página {publicFilters.page}
              </span>
              <button
                onClick={() => changePage(publicFilters.page + 1)}
                disabled={publicPosts.length < publicFilters.limit}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          )}
        </main>
      </div>
    );
  };

  // Render principal condicional
  if (!isAuthenticated && !isPublicView && currentView !== 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
            ModernBlog
          </h1>
          <p className="text-gray-600 mb-8">Sistema de gestión de contenido moderno</p>

          <div className="space-y-4">
            <button
              onClick={() => setIsPublicView(true)}
              className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white py-3 px-4 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              Ver Blog Público
            </button>

            <button
              onClick={() => { setCurrentPostId(null); setCurrentView('login'); }}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Panel de Administración
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar vista de login cuando se solicita
  if (!isAuthenticated && currentView === 'login') {
    return <LoginView />;
  }

  if (isPublicView) {
    return <PublicBlogView currentPost={currentPost} setCurrentPost={setCurrentPost} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <Sidebar />

      <div className="flex-1 overflow-hidden">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                {currentView === 'dashboard' && 'Dashboard'}
                {currentView === 'posts' && 'Artículos'}
                {currentView === 'editor' && (editorForm.id ? 'Editar Artículo' : 'Nuevo Artículo')}
                {currentView === 'categories' && 'Categorías'}
                {currentView === 'comments' && 'Comentarios'}
                {currentView === 'users' && 'Usuarios'}
                {currentView === 'settings' && 'Configuración'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-64"
                />
              </div>
              {/* Botón del tema */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {isDarkMode ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                )}
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{user?.name || 'Admin User'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email || 'admin@blog.com'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Salir
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6 overflow-y-auto h-full bg-gray-50 dark:bg-gray-900">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'posts' && <PostsList />}
          {currentView === 'editor' && <ArticleEditor localForm={editorLocalForm} setLocalForm={setEditorLocalFormCallback} />}

          {/* Vista de Categorías */}
          {currentView === 'categories' && <CategoriesView />}

          {currentView === 'comments' && <CommentsView />}

          {currentView === 'users' && <UsersView />}

          {currentView === 'settings' && <SettingsView />}
        </main>
      </div>

      <Notification />
    </div>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AdminPanel />
    </ThemeProvider>
  );
};

export default App;