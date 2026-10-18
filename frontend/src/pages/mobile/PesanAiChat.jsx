import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Bot, 
  Send, 
  Sparkles, 
  MapPin, 
  Store, 
  ShoppingBag, 
  CheckCircle2, 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle,
  HelpCircle,
  Clock,
  ChevronRight,
  User,
  Edit2,
  Search,
  CheckCheck,
  Receipt,
  Headphones,
  MessageSquare,
  ExternalLink,
  X,
  Truck,
  Package,
  Mic,
  MicOff,
  Volume2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/axios';
import { useAuthStore } from '../../store/authStore';

/**
 * WhatsApp / Chat style text parser
 * Converts *bold*, **bold**, ***bold+italic***, _italic_, ~strikethrough~, `code`, ```codeblock```, and URLs
 */
const INLINE_CHAT_REGEX = /(```[\s\S]*?```|`[^`\n]+`|\*\*\*[^*\n]+?\*\*\*|\*\*[^*\n]+?\*\*|\*[^\s*\n](?:[^*\n]*?[^\s*\n])?\*|(?<=^|[^\w])_[^\s_\n](?:[^_\n]*?[^\s_\n])?_(?=[^\w]|$)|~[^\s~\n](?:[^~\n]*?[^\s~\n])?~|https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;

function renderFormattedChatMessage(text, isUser = false) {
  if (!text || typeof text !== 'string') return text;

  const parts = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(INLINE_CHAT_REGEX.source, 'g');

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `fmt-${match.index}`;

    if (token.startsWith('```') && token.endsWith('```')) {
      const content = token.slice(3, -3);
      parts.push(
        <pre key={key} className={`my-1.5 p-2 font-mono text-[11px] overflow-x-auto rounded-none border ${isUser ? 'bg-green-900/80 text-green-100 border-green-500/40' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700'}`}>
          <code>{content}</code>
        </pre>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const content = token.slice(1, -1);
      parts.push(
        <code key={key} className={`px-1 py-0.5 mx-0.5 font-mono text-[11px] rounded-none ${isUser ? 'bg-green-800 text-green-100' : 'bg-gray-100 dark:bg-gray-800 text-green-700 dark:text-green-400 border border-gray-200 dark:border-gray-700'}`}>
          {content}
        </code>
      );
    } else if (token.startsWith('***') && token.endsWith('***')) {
      const content = token.slice(3, -3);
      parts.push(
        <strong key={key} className={`font-bold italic ${isUser ? 'text-white' : 'text-gray-950 dark:text-white'}`}>
          {content}
        </strong>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      const content = token.slice(2, -2);
      parts.push(
        <strong key={key} className={`font-bold ${isUser ? 'text-white' : 'text-gray-950 dark:text-white'}`}>
          {content}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      const content = token.slice(1, -1);
      parts.push(
        <strong key={key} className={`font-bold ${isUser ? 'text-white' : 'text-gray-950 dark:text-white'}`}>
          {content}
        </strong>
      );
    } else if (token.startsWith('_') && token.endsWith('_')) {
      const content = token.slice(1, -1);
      parts.push(
        <em key={key} className={`italic ${isUser ? 'text-green-50' : 'text-gray-700 dark:text-gray-300'}`}>
          {content}
        </em>
      );
    } else if (token.startsWith('~') && token.endsWith('~')) {
      const content = token.slice(1, -1);
      parts.push(
        <del key={key} className={`line-through opacity-75 ${isUser ? 'text-green-200' : 'text-gray-500 dark:text-gray-400'}`}>
          {content}
        </del>
      );
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      parts.push(
        <a
          key={key}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline font-medium break-all ${isUser ? 'text-green-100 hover:text-white' : 'text-green-600 dark:text-green-400 hover:underline'}`}
        >
          {token}
        </a>
      );
    } else {
      parts.push(token);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export default function PesanAiChat() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const defaultRoom = user?.santri_room ? `Kamar ${user.santri_room}` : 'Kamar Santri Al-Mannan';

  const [inputMessage, setInputMessage] = useState('');
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [editRecipientName, setEditRecipientName] = useState('');
  const [editRecipientRoom, setEditRecipientRoom] = useState('');
  const [santriSearchResults, setSantriSearchResults] = useState([]);
  const [isSearchingSantri, setIsSearchingSantri] = useState(false);
  const [isSantriVerified, setIsSantriVerified] = useState(true);
  const [selectedSantri, setSelectedSantri] = useState(null);
  const [editingVariantKey, setEditingVariantKey] = useState(null);
  const [customVariantInput, setCustomVariantInput] = useState('');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [selectedCanteenId, setSelectedCanteenId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceInterimText, setVoiceInterimText] = useState('');
  const searchTimeoutRef = useRef(null);
  const recognitionRef = useRef(null);

  // Inisialisasi Web Speech Recognition untuk Pemesanan Suara (Voice Ordering)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = 'id-ID';

          recognition.onstart = () => {
            setIsListening(true);
            setVoiceInterimText('');
          };

          recognition.onresult = (event) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                final += event.results[i][0].transcript;
              } else {
                interim += event.results[i][0].transcript;
              }
            }

            if (interim) {
              setVoiceInterimText(interim);
            }

            if (final) {
              setInputMessage((prev) => (prev ? `${prev} ${final}` : final).trim());
              setVoiceInterimText('');
            }
          };

          recognition.onerror = (event) => {
            setIsListening(false);
            setVoiceInterimText('');
            if (event.error === 'not-allowed') {
              toast.error('Izin mikrofon ditolak. Mohon aktifkan izin mikrofon di browser.');
            } else if (event.error === 'no-speech') {
              toast('Tidak ada suara terdeteksi. Silakan coba tekan mic lagi ya.', { icon: '🎙️' });
            } else if (event.error !== 'aborted') {
              toast.error(`Gagal merekam suara (${event.error})`);
            }
          };

          recognition.onend = () => {
            setIsListening(false);
            setVoiceInterimText('');
          };

          recognitionRef.current = recognition;
        } catch (err) {
          console.warn('[PesanAiChat] SpeechRecognition init error:', err);
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const handleToggleVoice = () => {
    const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (!SpeechRecognition) {
      toast.error('Browser ini belum mendukung Speech Recognition. Gunakan Google Chrome atau browser modern di HP.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        setIsListening(false);
      }
    } else {
      try {
        recognitionRef.current?.start();
        toast('🎙️ Mendengarkan... Silakan sebutkan pesananmu!', { duration: 3000 });
      } catch (e) {
        console.error('Error starting recognition:', e);
      }
    }
  };

  // Ambil data kontak Admin HiGO dan Toko/Kantin
  const { data: supportResponse } = useQuery({
    queryKey: ['ai-support-contacts'],
    queryFn: async () => {
      const res = await api.get('/ai/support-contacts');
      return res.data;
    },
    staleTime: 1000 * 60 * 10,
  });
  const supportData = supportResponse?.data;

  // Ambil data katalog kantin untuk mencocokkan konfigurasi varian resmi toko
  const { data: canteensResponse } = useQuery({
    queryKey: ['canteens-for-variants'],
    queryFn: async () => {
      const res = await api.get('/canteens');
      return res.data?.data || res.data || [];
    },
    staleTime: 1000 * 60 * 15,
  });
  const canteensList = Array.isArray(canteensResponse) ? canteensResponse : [];

  // Helper untuk mendapatkan konfigurasi varian resmi toko untuk produk tertentu
  const getProductVariantConfig = (item) => {
    if (item?.variant_config) return item.variant_config;
    for (const c of canteensList) {
      if (Array.isArray(c.products)) {
        const found = c.products.find(
          (p) => (item.product_id && p.id === item.product_id) || p.name?.toLowerCase() === item.name?.toLowerCase()
        );
        if (found && found.variant_config) {
          return found.variant_config;
        }
      }
    }
    return null;
  };

  // Helper untuk mengekstrak seksi varian yang BENAR-BENAR disediakan oleh toko
  const getAvailableVariantSections = (item) => {
    const cfg = getProductVariantConfig(item);
    const sections = [];

    if (cfg) {
      // 1. Level Pedas (HANYA jika toko menyediakan opsi level pedas)
      const hasSpicy = Boolean(cfg.spicy?.enabled);
      if (hasSpicy) {
        let spicyList = [];
        if (Array.isArray(cfg.spicy?.options) && cfg.spicy.options.length > 0) {
          spicyList = cfg.spicy.options.map((opt) => (typeof opt === 'string' ? opt : opt.name || String(opt)));
        } else {
          const max = cfg.spicy?.maxLevel || 3;
          spicyList = ['Lv 0 (Tidak Pedas)'];
          for (let i = 1; i <= max; i++) spicyList.push(`Lv ${i}`);
        }
        if (spicyList.length > 0) {
          sections.push({
            title: cfg.spicy?.label || 'Level Pedas',
            chips: spicyList.map((s) => (s.startsWith('[') ? s : `[${s}]`))
          });
        }
      }

      // 2. Porsi (HANYA jika toko secara eksplisit mengaktifkan opsi ukuran porsi)
      const hasPortion = Boolean(cfg.portion?.enabled);
      if (hasPortion) {
        let portionList = [];
        if (Array.isArray(cfg.portion?.options) && cfg.portion.options.length > 0) {
          portionList = cfg.portion.options.map((opt) => (typeof opt === 'string' ? opt : opt.name || String(opt)));
        } else {
          portionList = ['Porsi Biasa', 'Porsi Jumbo'];
        }
        if (portionList.length > 0) {
          sections.push({
            title: cfg.portion?.label || 'Pilihan Porsi',
            chips: portionList.map((p) => (p.startsWith('[') ? p : `[${p}]`))
          });
        }
      }

      // 3. Suhu / Minuman (HANYA jika toko mengaktifkan opsi sajian/suhu)
      const hasTemp = Boolean(cfg.temperature?.enabled);
      if (hasTemp) {
        let tempList = [];
        if (Array.isArray(cfg.temperature?.options) && cfg.temperature.options.length > 0) {
          tempList = cfg.temperature.options.map((opt) => (typeof opt === 'string' ? opt : opt.name || String(opt)));
        } else {
          tempList = ['Es / Dingin', 'Panas / Hangat'];
        }
        if (tempList.length > 0) {
          sections.push({
            title: cfg.temperature?.label || 'Pilihan Suhu',
            chips: tempList.map((t) => (t.startsWith('[') ? t : `[${t}]`))
          });
        }
      }

      // 4. Custom Groups (HANYA jika toko secara eksplisit mengaktifkan custom groups seperti Kuah, Toping, dll)
      const hasCustom = Boolean(cfg.custom?.enabled) && Array.isArray(cfg.custom?.groups);
      if (hasCustom) {
        cfg.custom.groups.forEach((grp) => {
          const grpOptions = grp.items || grp.options || [];
          if (Array.isArray(grpOptions) && grpOptions.length > 0) {
            sections.push({
              title: grp.name || 'Pilihan Khusus',
              chips: grpOptions.map((opt) => {
                const optName = typeof opt === 'string' ? opt : opt.name || '';
                return optName.startsWith('[') ? optName : `[${optName}]`;
              })
            });
          }
        });
      }
    }

    // Fallback cerdas jika produk belum diset variant_config di DB
    if (sections.length === 0) {
      const pName = (item.name || '').toLowerCase();
      const isDrink = pName.includes('es ') || pName.includes('teh') || pName.includes('kopi') || pName.includes('jus') || pName.includes('susu');
      const isSpicy = pName.includes('mercon') || pName.includes('geprek') || pName.includes('seblak') || pName.includes('pedas');

      if (isDrink) {
        sections.push({
          title: 'Pilihan Suhu Minuman',
          chips: ['[Es / Dingin]', '[Panas / Hangat]', '[Sedikit Es]']
        });
      } else if (isSpicy) {
        sections.push({
          title: 'Tingkat Kepedasan',
          chips: ['[Sedang]', '[Pedas]', '[Ekstra Mercon]', '[Tidak Pedas]']
        });
      } else {
        sections.push({
          title: 'Catatan Sajian',
          chips: ['[Tidak Pedas]', '[Bungkus Terpisah]']
        });
      }
    }

    return sections;
  };
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: `Assalamu'alaikum Kak ${user?.name ? user.name.split(' ')[0] : 'Santri'}! 🌟 Mau makan, minum, titip beli, atau cek status pesanan hari ini?\n\nKetik saja santai layaknya chat biasa, saya siapkan draf pesanan atau cek pesananmu langsung.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quick_replies: [
        "📦 Cek status pesanan saya",
        "🍲 1 Bakso Mercon antar ke kamar",
        "🍜 2 Mie Gacoan Lv 1 + 1 Udang Keju",
        "🥤 2 Es Teh Manis dingin",
        "🛒 Titip Beli Obat di Apotek"
      ],
      draft: null,
      orderConfirmed: false,
    }
  ]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Quick Prompt Recommendations
  const quickPrompts = [
    {
      label: '📦 Cek Status Pesanan',
      text: 'Bagaimana status pesanan saya saat ini, apakah sudah diterima santri?'
    },
    {
      label: '💬 Bantuan / Chat CS & Toko',
      text: 'Saya butuh bantuan / kontak pengelola admin dan toko'
    },
    {
      label: '🍲 1 Bakso Mercon / Bakso Urat',
      text: `Mau pesan 1 Bakso Mercon antar ke ${defaultRoom}`
    },
    {
      label: '🍜 2 Mie Gacoan Lv 1 + 1 Udang Keju',
      text: `Halo, mau pesan Mie Gacoan level 1 dua porsi sama udang keju 1 porsi, antar ke ${defaultRoom} ya`
    },
    {
      label: '🥤 2 Es Teh Manis ke Kamar',
      text: `Mau pesan 2 Es Teh Manis dingin antar ke ${defaultRoom}`
    },
    {
      label: '🍗 1 Nasi Ayam Geprek Lv 3',
      text: `Pesan Nasi Ayam Geprek level 3 satu porsi tolong antar ke ${defaultRoom}`
    },
    {
      label: '🛒 Titip Beli Obat di Apotek',
      text: `Tolong titip belikan Paracetamol 1 strip dan Tolak Angin 2 sachet di apotek depan pondok, antar ke ${defaultRoom}`
    }
  ];

  // 1. Mutation: Send Chat to AI Assistant
  const chatMutation = useMutation({
    mutationFn: async ({ messageText, history }) => {
      const res = await api.post('/ai/chat-order', {
        message: messageText,
        history: history || []
      });
      return res.data;
    },
    onSuccess: (data) => {
      setMessages((prev) => {
        // Jika ada draf baru yang siap, tandai draf lama yang belum dikonfirmasi sebagai kedaluwarsa/terganti
        const updatedPrev = data.is_order_ready
          ? prev.map((m) => (m.draft && !m.orderConfirmed ? { ...m, draftExpired: true } : m))
          : prev;

        const aiReply = {
          id: Date.now() + 1,
          sender: 'assistant',
          text: data.reply_text || 'Pesanan Anda telah diproses.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quick_replies: data.quick_replies || [],
          support_contact: data.support_contact || null,
          is_help_intent: !data.is_order_ready && Boolean(data.is_help_intent || data.support_contact),
          order_status_info: data.order_status_info || null,
          is_check_order: Boolean(data.is_check_order),
          draft: data.is_order_ready ? data : null,
          orderConfirmed: false,
        };

        return [...updatedPrev, aiReply];
      });
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.message || 'Maaf, sistem asisten AI sedang sibuk. Silakan coba kirim ulang.';
      toast.error(errorMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: `⚠️ ${errorMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true
        }
      ]);
    }
  });

  // 2. Mutation: Confirm Draft Order & Create in DB
  const confirmMutation = useMutation({
    mutationFn: async ({ messageId, draftData }) => {
      const res = await api.post('/ai/confirm-order', {
        canteen_id: draftData.canteen_id,
        delivery_location: draftData.delivery_location,
        recipient_name: draftData.recipient_name,
        recipient_room: draftData.recipient_room,
        is_custom: draftData.is_custom,
        canteens: draftData.canteens,
        summary: draftData.summary,
      });
      return { messageId, data: res.data };
    },
    onSuccess: ({ messageId, data }) => {
      toast.success(data.message || 'Pesanan resmi berhasil dibuat!', {
        duration: 3500,
        position: 'top-center'
      });

      // Update message state so button turns to Confirmed
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, orderConfirmed: true, checkout_id: data.checkout_id }
            : msg
        )
      );

      // Invalidate relevant queries so orders appear in dashboard
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['user-orders'] });
      queryClient.invalidateQueries({ queryKey: ['cart'] });

      // Automatically redirect to Payment page after a brief moment
      setTimeout(() => {
        navigate({ to: '/dashboard/pembayaran' });
      }, 1200);
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.message || 'Gagal membuat pesanan. Pastikan profil kamar terisi.';
      toast.error(errorMsg);
    }
  });

  const fetchSantriSuggestions = (searchTerm) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchTerm || searchTerm.trim().length < 2) {
      setSantriSearchResults([]);
      setIsSearchingSantri(false);
      return;
    }

    setIsSearchingSantri(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/ai/santri-search', {
          params: { query: searchTerm.trim() }
        });
        if (res.data?.success) {
          setSantriSearchResults(res.data.data || []);
        }
      } catch (err) {
        console.error('Gagal mencari santri:', err);
      } finally {
        setIsSearchingSantri(false);
      }
    }, 250);
  };

  const handleRecipientNameChange = (val) => {
    setEditRecipientName(val);
    setIsSantriVerified(false);
    setSelectedSantri(null);
    fetchSantriSuggestions(val);
  };

  const handleSelectSantri = (santri) => {
    setEditRecipientName(santri.santri_name);
    setEditRecipientRoom(santri.santri_room || 'Kamar Santri');
    setIsSantriVerified(true);
    setSelectedSantri(santri);
    setSantriSearchResults([]);
  };

  const startEditingDraft = (msgId, draft) => {
    setEditingDraftId(msgId);
    const initialName = draft.recipient_name || user?.santri_name || user?.name || '';
    setEditRecipientName(initialName);
    setEditRecipientRoom(draft.recipient_room || draft.delivery_location || defaultRoom);
    setIsSantriVerified(true);
    setSelectedSantri(null);
    setSantriSearchResults([]);
  };

  const saveDraftRecipient = (msgId) => {
    if (!isSantriVerified && !selectedSantri) {
      toast.error('Wajib memilih nama santri dari data santri pondok yang terdaftar!');
      return;
    }

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.draft) {
          return {
            ...m,
            draft: {
              ...m.draft,
              recipient_name: editRecipientName.trim(),
              recipient_room: editRecipientRoom.trim(),
              delivery_location: editRecipientRoom.trim(),
            },
          };
        }
        return m;
      })
    );
    setEditingDraftId(null);
    setSantriSearchResults([]);
    toast.success('Penerima santri terverifikasi dan tujuan antar diperbarui!');
  };

  // 1. Tambah / Kurang Quantity Produk di Draf
  const handleUpdateItemQty = (msgId, cIdx, itIdx, delta) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.draft) return m;

        const draft = JSON.parse(JSON.stringify(m.draft));
        const canteen = draft.canteens?.[cIdx];
        if (!canteen || !canteen.items?.[itIdx]) return m;

        const item = canteen.items[itIdx];
        const newQty = (item.quantity || 1) + delta;

        if (newQty <= 0) {
          canteen.items.splice(itIdx, 1);
          toast.success(`${item.name} dihapus dari pesanan`);
        } else {
          item.quantity = newQty;
          item.subtotal = Number(item.price) * newQty;
        }

        // Hapus kantin jika semua itemnya habis
        draft.canteens = draft.canteens.filter((c) => c.items && c.items.length > 0);

        if (draft.canteens.length === 0) {
          return {
            ...m,
            draft: null,
            text: m.text + '\n\n*(Semua produk telah dihapus dari draf pesanan)*'
          };
        }

        // Hitung ulang items_subtotal dan grand_total
        let newItemsSubtotal = 0;
        draft.canteens.forEach((c) => {
          c.items.forEach((it) => {
            newItemsSubtotal += Number(it.price) * Number(it.quantity);
          });
        });

        const deliveryFee = Number(draft.summary?.delivery_fee || 3000);
        const adminFee = Number(draft.summary?.admin_fee || 2000);
        const grandTotal = newItemsSubtotal + deliveryFee + adminFee;

        draft.summary = {
          ...draft.summary,
          subtotal: newItemsSubtotal,
          items_subtotal: newItemsSubtotal,
          delivery_fee: deliveryFee,
          admin_fee: adminFee,
          grand_total: grandTotal,
        };

        return {
          ...m,
          draft
        };
      })
    );
  };

  // 2. Ubah Varian Produk di Draf (Level Pedas / Suhu / Catatan)
  const handleUpdateItemVariant = (msgId, cIdx, itIdx, newVariant) => {
    const formatted = newVariant.trim();
    if (!formatted) return;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.draft) return m;

        const draft = JSON.parse(JSON.stringify(m.draft));
        const canteen = draft.canteens?.[cIdx];
        if (!canteen || !canteen.items?.[itIdx]) return m;

        canteen.items[itIdx].notes = formatted;
        canteen.items[itIdx].variant = formatted;

        return {
          ...m,
          draft
        };
      })
    );
    setEditingVariantKey(null);
    setCustomVariantInput('');
    toast.success(`Varian diperbarui: ${formatted}`);
  };

  const handleSendMessage = (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || chatMutation.isPending) return;

    // Kumpulkan riwayat 8 pesan terakhir agar AI paham konteks revisi & tanya jawab
    const recentHistory = messages.slice(-8).map((m) => ({
      sender: m.sender,
      text: m.text,
    }));

    // Append user message
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');

    // Trigger AI request with message & history
    chatMutation.mutate({ messageText: text, history: recentHistory });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: Date.now(),
        sender: 'assistant',
        text: `Percakapan telah direset. Ada yang ingin Kakak pesan lagi? Tuliskan saja menunya langsung di bawah ya! 😊`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        draft: null,
        orderConfirmed: false,
      }
    ]);
  };

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 w-full max-w-3xl mx-auto bg-slate-100 dark:bg-gray-950 border-x border-gray-200 dark:border-gray-800 font-sans overflow-hidden">
      {/* 1. COMPACT TOP HEADER (TERKUNCI DI ATAS DALAM FLEX FLOW) */}
      <div className="shrink-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-3 py-2 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.history.length > 1 ? window.history.back() : navigate({ to: '/kantin' })}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors rounded-none"
            title="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="relative">
            <div className="w-8 h-8 bg-green-600 text-white flex items-center justify-center font-bold shadow-xs rounded-none">
              <Bot className="w-4 h-4" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border border-white dark:border-gray-900 rounded-full animate-pulse"></span>
          </div>

          <div>
            <div className="flex items-center gap-1.5 leading-tight">
              <h1 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
                Asisten Belanja AI
              </h1>
              <span className="px-1 py-0.2 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 text-[9px] font-bold font-mono border border-green-200 dark:border-green-800">
                GEMINI
              </span>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Online • Terhubung Katalog Kantin</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsHelpModalOpen(true)}
            className="px-2 py-1 bg-green-50 dark:bg-green-950/80 hover:bg-green-100 dark:hover:bg-green-900 text-green-700 dark:text-green-300 transition-colors text-[11px] font-bold flex items-center gap-1 border border-green-200 dark:border-green-800 rounded-none cursor-pointer"
            title="Pusat Bantuan CS & Kontak Toko"
          >
            <Headphones className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            <span className="hidden xs:inline sm:inline">Bantuan CS</span>
          </button>

          <button
            type="button"
            onClick={handleResetChat}
            className="px-2 py-1 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-[11px] font-bold flex items-center gap-1 border border-gray-200 dark:border-gray-800 rounded-none cursor-pointer"
            title="Reset Obrolan"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Mulai Baru</span>
          </button>
        </div>
      </div>

      {/* QUICK HORIZONTAL CHIPS BAR (TERKUNCI DI BAWAH HEADER DALAM FLEX FLOW) */}
      <div className="shrink-0 z-10 bg-gray-50 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-800 px-2.5 py-1.5 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none">
        <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 dark:text-green-400 shrink-0 uppercase tracking-wider pr-1 border-r border-gray-200 dark:border-gray-800">
          <Sparkles className="w-3 h-3 text-green-600 animate-pulse" />
          <span>Contoh:</span>
        </span>
        {quickPrompts.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(q.text)}
            disabled={chatMutation.isPending}
            className="shrink-0 text-[10.5px] font-medium px-2 py-0.5 bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-950 text-gray-700 dark:text-gray-300 hover:text-green-700 dark:hover:text-green-300 border border-gray-200 dark:border-gray-700 hover:border-green-500 rounded-none transition-colors cursor-pointer"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* 2. CHAT MESSAGES SCROLL AREA (HANYA INI YANG MENGALAMI SCROLL) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3 space-y-2.5 overscroll-contain">
        {/* Message Bubbles */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'user' ? (
              /* User Bubble (Kanan, Hijau Tegas WhatsApp Style) */
              <div className="max-w-[85%] sm:max-w-[78%] bg-green-700 text-white border border-green-600 rounded-none shadow-xs p-2.5 text-xs sm:text-[13px] leading-relaxed">
                <div className="whitespace-pre-line font-medium break-words">
                  {renderFormattedChatMessage(msg.text, true)}
                </div>
                <div className="flex items-center justify-end gap-1 mt-1 text-[9.5px] text-green-200 font-mono">
                  <span>{msg.timestamp}</span>
                  <CheckCheck className="w-3.5 h-3.5 text-green-200 shrink-0" />
                </div>
              </div>
            ) : (
              /* Assistant Bubble (Kiri, Terstruktur dengan Mini Avatar Bot) */
              <div className="flex items-start gap-1.5 max-w-[94%] sm:max-w-[85%]">
                <div className="w-6 h-6 bg-green-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs rounded-none">
                  <Bot className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-800 border-l-2 border-l-green-500 rounded-none shadow-xs p-2.5 sm:p-3 text-xs sm:text-[13px] leading-relaxed">
                  <div className="text-[10px] font-bold text-green-700 dark:text-green-400 mb-1 flex items-center justify-between">
                    <span>Asisten AI Higo</span>
                    <span className="text-[9.5px] text-gray-400 font-mono">{msg.timestamp}</span>
                  </div>

                  <div className="whitespace-pre-line font-normal break-words">
                    {renderFormattedChatMessage(msg.text, false)}
                  </div>

                  {/* ACTION CARDS KONTAK LANGSUNG WHATSAPP (HANYA ADMIN) */}
                  {msg.support_contact?.admin && (
                    <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-gray-700/80 space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-green-800 dark:text-green-300 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Headphones className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                          <span>Hubungi Admin Langsung:</span>
                        </span>
                        <span className="text-[9px] bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 font-bold px-1 py-0.2 border border-green-200 dark:border-green-800">
                          WHATSAPP RESMI
                        </span>
                      </div>

                      {/* Card Admin HiGO */}
                      <div className="p-2.5 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 flex flex-col justify-between rounded-none shadow-2xs">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded-none uppercase tracking-wider">
                              Admin HiGO
                            </span>
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                              {msg.support_contact.admin.phone}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {msg.support_contact.admin.name}
                          </div>
                          <p className="text-[10px] text-gray-600 dark:text-gray-300 leading-tight mt-0.5">
                            Bantuan pengaduan kurir, kendala aplikasi, atau sistem pondok.
                          </p>
                        </div>
                        <a
                          href={msg.support_contact.admin.wa_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2.5 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-2 text-[11px] text-center flex items-center justify-center gap-1.5 rounded-none transition-colors shadow-2xs cursor-pointer active:scale-[0.99]"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat WhatsApp Admin</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* KARTU STATUS PESANAN REAL-TIME (ORDER TRACKER CARD) */}
                  {msg.order_status_info && (
                    <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-gray-700/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-black uppercase tracking-wider text-green-800 dark:text-green-300 flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                          <span>Status Pesanan Terkini:</span>
                        </div>
                        <span className="font-mono text-[9.5px] font-bold text-gray-500 dark:text-gray-400">
                          #ORD-{msg.order_status_info.order_id}
                        </span>
                      </div>

                      {/* Status Banner */}
                      <div className={`p-2 border rounded-none flex items-start gap-2 ${
                        msg.order_status_info.is_received 
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                          : msg.order_status_info.status === 'processing'
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                          : msg.order_status_info.status === 'pending'
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-100'
                          : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100'
                      }`}>
                        {msg.order_status_info.is_received ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : msg.order_status_info.status === 'processing' ? (
                          <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                        ) : (
                          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold leading-tight">
                            {msg.order_status_info.status_label}
                          </div>
                          <p className="text-[10px] opacity-85 leading-tight mt-0.5">
                            {msg.order_status_info.is_received 
                              ? 'Pesanan telah diserahterimakan dan sampai di tangan santri.' 
                              : msg.order_status_info.status === 'processing'
                              ? 'Kurir sedang dalam perjalanan menuju kamar santri.'
                              : 'Menunggu konfirmasi pembayaran dan penyiapan toko.'}
                          </p>
                        </div>
                      </div>

                      {/* Detail Rincian Grid */}
                      <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 p-2 text-[11px] space-y-1 rounded-none">
                        <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                          <span className="text-[10px] text-gray-500">Toko / Kantin:</span>
                          <span className="font-bold text-gray-900 dark:text-white truncate max-w-[65%]">
                            {msg.order_status_info.canteen_name}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                          <span className="text-[10px] text-gray-500">Menu Dipesan:</span>
                          <span className="font-medium text-gray-900 dark:text-white truncate max-w-[65%]">
                            {msg.order_status_info.items_text}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                          <span className="text-[10px] text-gray-500">Penerima & Kamar:</span>
                          <span className="font-bold text-green-700 dark:text-green-400 truncate max-w-[65%]">
                            {msg.order_status_info.recipient_name} ({msg.order_status_info.recipient_room})
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                          <span className="text-[10px] text-gray-500">Kurir Pengantar:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {msg.order_status_info.courier_name || 'Menunggu Penugasan Kurir'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-[10px] text-gray-500">Total Biaya:</span>
                          <span className="font-mono font-bold text-green-700 dark:text-green-400">
                            Rp {Number(msg.order_status_info.total_price || 0).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => navigate({ to: '/pembayaran' })}
                          className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-1.5 px-2 text-[10.5px] text-center flex items-center justify-center gap-1 rounded-none transition-colors shadow-2xs cursor-pointer active:scale-[0.99]"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>Riwayat Pesanan</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsHelpModalOpen(true)}
                          className="w-full bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 font-bold py-1.5 px-2 text-[10.5px] text-center flex items-center justify-center gap-1 rounded-none transition-colors shadow-2xs cursor-pointer active:scale-[0.99]"
                        >
                          <Headphones className="w-3 h-3 text-green-600" />
                          <span>Tanya Kurir / CS</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Action Chips jika ada */}
                  {msg.quick_replies && msg.quick_replies.length > 0 && !msg.orderConfirmed && !msg.draftExpired && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/80">
                      <div className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-green-600" />
                        <span>Pilihan Cepat (Tinggal Tap):</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {msg.quick_replies.map((reply, rIdx) => (
                          <button
                            key={rIdx}
                            type="button"
                            disabled={chatMutation.isPending}
                            onClick={() => handleSendMessage(reply)}
                            className="text-left text-[10.5px] font-semibold px-2 py-1 bg-green-50 dark:bg-green-950/70 hover:bg-green-600 hover:text-white text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/80 transition-colors cursor-pointer rounded-none active:scale-[0.98]"
                          >
                            {reply}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* DRAFT ORDER COMPACT CARD: Chat -> Quantity -> Varian -> Konfirmasi Pesanan */}
                  {msg.draft && (
                    <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
                      {/* List Items Kompak */}
                      <div className="space-y-1.5">
                        {msg.draft.canteens?.map((canteen, cIdx) => (
                          <div key={cIdx} className="space-y-1">
                            {canteen.items?.map((it, itIdx) => {
                              const isEditingVariant = editingVariantKey === `${msg.id}-${cIdx}-${itIdx}`;
                              const currentVariant = it.notes || it.variant || '';
                              const variantSections = getAvailableVariantSections(it);

                              return (
                                <div
                                  key={itIdx}
                                  className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 p-2 text-xs"
                                >
                                  {/* Row 1: Nama Menu, Toko & Subtotal */}
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <div className="min-w-0">
                                      <span className="font-bold text-gray-900 dark:text-white truncate block">
                                        {it.name}
                                      </span>
                                      {canteen.canteen_name && (
                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                                          <Store className="w-2.5 h-2.5 text-green-600" />
                                          {canteen.canteen_name}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono font-bold text-gray-900 dark:text-white shrink-0">
                                      Rp {(Number(it.price) * Number(it.quantity)).toLocaleString('id-ID')}
                                    </span>
                                  </div>

                                  {/* Row 2: Varian & Stepper Qty Sebaris */}
                                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-100 dark:border-gray-700/60">
                                    {/* Varian Button */}
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold shrink-0">
                                        Varian:
                                      </span>
                                      {!msg.orderConfirmed && !msg.draftExpired ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingVariantKey(isEditingVariant ? null : `${msg.id}-${cIdx}-${itIdx}`);
                                            setCustomVariantInput(currentVariant.replace(/[\[\]]/g, ''));
                                          }}
                                          className={`text-[10.5px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 cursor-pointer transition-colors max-w-[150px] truncate ${
                                            currentVariant
                                              ? 'bg-green-50 dark:bg-green-950/70 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300'
                                              : 'bg-gray-50 dark:bg-gray-700/50 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                                          }`}
                                          title="Klik untuk memilih/mengubah varian toko"
                                        >
                                          <span className="truncate">{currentVariant || '+ Pilih Varian'}</span>
                                          <span className="text-[8px] text-gray-400 shrink-0">▾</span>
                                        </button>
                                      ) : (
                                        <span className="text-[10.5px] font-mono font-bold px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                          {currentVariant || 'Standar'}
                                        </span>
                                      )}
                                    </div>

                                    {/* Stepper Quantity */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      {!msg.orderConfirmed && !msg.draftExpired ? (
                                        <div className="inline-flex items-center border border-gray-300 dark:border-gray-600">
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateItemQty(msg.id, cIdx, itIdx, -1)}
                                            className="w-5 h-5 bg-gray-100 dark:bg-gray-700 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/80 text-gray-700 dark:text-gray-200 flex items-center justify-center font-bold text-xs cursor-pointer select-none transition-colors"
                                            title="Kurangi"
                                          >
                                            -
                                          </button>
                                          <span className="w-5 text-center text-xs font-bold font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-900">
                                            {it.quantity}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateItemQty(msg.id, cIdx, itIdx, 1)}
                                            className="w-5 h-5 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center font-bold text-xs cursor-pointer select-none transition-colors"
                                            title="Tambah"
                                          >
                                            +
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="font-bold text-xs font-mono">{it.quantity}x</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Compact Inline Variant Selector Popover */}
                                  {isEditingVariant && !msg.orderConfirmed && !msg.draftExpired && (
                                    <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30 p-2 space-y-1.5">
                                      <div className="flex items-center justify-between text-[10px] font-bold text-gray-700 dark:text-gray-300">
                                        <span className="flex items-center gap-1">
                                          <Sparkles className="w-3 h-3 text-green-600" />
                                          <span>Pilih varian untuk {it.name}:</span>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setEditingVariantKey(null)}
                                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-bold cursor-pointer"
                                        >
                                          ✕ Tutup
                                        </button>
                                      </div>

                                      {/* Variant sections dari toko */}
                                      {variantSections.map((sec, secIdx) => (
                                        <div key={secIdx} className="space-y-0.5">
                                          <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                                            {sec.title}:
                                          </span>
                                          <div className="flex flex-wrap gap-1">
                                            {sec.chips.map((vChip) => {
                                              const isSelected = currentVariant === vChip || currentVariant.includes(vChip.replace(/[\[\]]/g, ''));
                                              return (
                                                <button
                                                  key={vChip}
                                                  type="button"
                                                  onClick={() => handleUpdateItemVariant(msg.id, cIdx, itIdx, vChip)}
                                                  className={`text-[10px] px-2 py-0.5 border font-mono font-bold cursor-pointer transition-all active:scale-95 ${
                                                    isSelected
                                                      ? 'bg-green-600 text-white border-green-700 shadow-2xs'
                                                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-green-500'
                                                  }`}
                                                >
                                                  {vChip}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ))}

                                      {/* Custom Variant Note Input */}
                                      <div className="pt-1 border-t border-green-200/60 dark:border-green-900/60 flex items-center gap-1">
                                        <input
                                          type="text"
                                          value={customVariantInput}
                                          onChange={(e) => setCustomVariantInput(e.target.value)}
                                          placeholder="Catatan tambahan (opsional)..."
                                          className="flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 px-1.5 py-0.5 text-[10px] rounded-none outline-none focus:border-green-600 text-gray-800 dark:text-gray-200"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateItemVariant(msg.id, cIdx, itIdx, customVariantInput ? `[${customVariantInput.replace(/[\[\]]/g, '')}]` : '')}
                                          className="px-2 py-0.5 text-[10px] font-bold bg-green-600 text-white cursor-pointer hover:bg-green-700"
                                        >
                                          Simpan
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>

                  {/* Recipient & Delivery Info - Ultra Compact 1 Line */}
                  <div className="bg-gray-50 dark:bg-gray-800/40 px-2 py-1 border border-gray-200 dark:border-gray-700/60 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 truncate text-gray-700 dark:text-gray-300">
                      <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                      <span className="font-bold text-gray-900 dark:text-white truncate">
                        {msg.draft.recipient_room || msg.draft.delivery_location || defaultRoom}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="truncate">
                        {msg.draft.recipient_name || user?.santri_name || user?.name || 'Santri'}
                      </span>
                    </div>
                    {!msg.orderConfirmed && !msg.draftExpired && (
                      <button
                        type="button"
                        onClick={() => startEditingDraft(msg.id, msg.draft)}
                        className="text-[10px] text-green-700 dark:text-green-400 hover:underline font-bold shrink-0 ml-1.5 cursor-pointer flex items-center gap-0.5"
                      >
                        <Edit2 className="w-2.5 h-2.5" /> Ubah
                      </button>
                    )}
                  </div>

                    {/* Inline Editor jika tombol Ubah ditekan */}
                    {editingDraftId === msg.id && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2 bg-white dark:bg-gray-900 p-2.5 border border-green-500 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-black text-gray-800 dark:text-gray-200 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-green-600" />
                            <span>Cari & Pilih Penerima dari Data Santri:</span>
                          </div>
                          {isSantriVerified && (
                            <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/80 px-1.5 py-0.5 border border-green-300 dark:border-green-800 flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3 text-green-600" /> Terverifikasi
                            </span>
                          )}
                        </div>

                        {/* Search Input Santri */}
                        <div className="relative">
                          <label className="text-[9px] font-bold text-gray-500 block mb-0.5">
                            Nama Santri (Ketik untuk mencari di Data Santri):
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={editRecipientName}
                              onChange={(e) => handleRecipientNameChange(e.target.value)}
                              placeholder="Ketik nama santri (misal: Laila, Zidan...)"
                              className={`w-full bg-slate-50 dark:bg-gray-800 border ${
                                isSantriVerified
                                  ? 'border-green-500 dark:border-green-500'
                                  : 'border-amber-400 dark:border-amber-500'
                              } px-2.5 py-1.5 text-xs rounded-none outline-none focus:border-green-600 pr-7 font-semibold text-gray-900 dark:text-white`}
                            />
                            {isSearchingSantri ? (
                              <RefreshCw className="w-3.5 h-3.5 text-green-600 animate-spin absolute right-2" />
                            ) : (
                              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2 pointer-events-none" />
                            )}
                          </div>

                          {/* Dropdown Live Search Results */}
                          {santriSearchResults.length > 0 && (
                            <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 shadow-lg divide-y divide-gray-100 dark:divide-gray-800">
                              <div className="px-2 py-1 text-[9px] font-bold text-gray-400 uppercase bg-gray-50 dark:bg-gray-800/60 flex items-center justify-between">
                                <span>Hasil Pencarian Data Santri</span>
                                <span className="font-mono text-green-600">({santriSearchResults.length} ditemukan)</span>
                              </div>
                              {santriSearchResults.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => handleSelectSantri(s)}
                                  className="w-full text-left p-2 hover:bg-green-50 dark:hover:bg-green-950/60 transition-colors cursor-pointer flex items-center justify-between gap-2"
                                >
                                  <div>
                                    <div className="font-bold text-xs text-gray-900 dark:text-white">
                                      {s.santri_name}
                                    </div>
                                    <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                                      <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                                        <MapPin className="w-2.5 h-2.5" />
                                        {s.santri_room}
                                      </span>
                                      <span>•</span>
                                      <span>Kelas: {s.santri_class}</span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900 px-1.5 py-0.5 shrink-0">
                                    Pilih
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Warnings */}
                          {!isSantriVerified && editRecipientName.trim().length >= 2 && santriSearchResults.length === 0 && !isSearchingSantri && (
                            <p className="text-[10px] text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>Tidak ditemukan di data santri pondok. Wajib yang ada di data santri.</span>
                            </p>
                          )}
                          {!isSantriVerified && santriSearchResults.length > 0 && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>Silakan klik salah satu nama santri di atas untuk memverifikasi.</span>
                            </p>
                          )}
                        </div>

                        {/* Input Kamar / Lokasi Antar (Otomatis Terisi) */}
                        <div>
                          <label className="text-[9px] font-bold text-gray-500 block mb-0.5">
                            Kamar / Lokasi Antar (Otomatis dari Data Santri):
                          </label>
                          <input
                            type="text"
                            value={editRecipientRoom}
                            onChange={(e) => setEditRecipientRoom(e.target.value)}
                            placeholder="Otomatis terisi kamar santri"
                            className="w-full bg-slate-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-xs rounded-none outline-none focus:border-green-600 text-gray-800 dark:text-gray-200"
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDraftId(null);
                              setSantriSearchResults([]);
                            }}
                            className="px-2.5 py-1 text-[11px] bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-300"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            disabled={!isSantriVerified}
                            onClick={() => saveDraftRecipient(msg.id)}
                            className="px-3.5 py-1 text-[11px] bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold transition-colors shadow-xs"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    )}

                  {/* Action Button: Konfirmasi Pesanan dengan Total Terintegrasi */}
                  {msg.orderConfirmed ? (
                    <div className="w-full bg-emerald-600 text-white font-bold p-2 text-center text-xs flex items-center justify-center gap-1.5 shadow-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Pesanan Berhasil Dibuat! Mengarahkan ke Pembayaran...</span>
                    </div>
                  ) : msg.draftExpired ? (
                    <div className="w-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium p-1.5 text-center text-[10px] border border-gray-200 dark:border-gray-700">
                      🔄 Draf telah diperbarui oleh pesan terbaru
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={confirmMutation.isPending}
                      onClick={() => confirmMutation.mutate({ messageId: msg.id, draftData: msg.draft })}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2.5 px-3 text-xs flex items-center justify-between transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                    >
                      {confirmMutation.isPending ? (
                        <div className="w-full flex items-center justify-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Memproses Pesanan...</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Konfirmasi Pesanan</span>
                          </div>
                          <span className="font-mono text-xs bg-green-700/90 px-2 py-0.5">
                            Total: Rp {Number(msg.draft.summary?.grand_total || 0).toLocaleString('id-ID')}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    ))}

        {/* Loading Typing Indicator */}
        {chatMutation.isPending && (
          <div className="flex flex-col items-start space-y-1">
            <span className="text-[10px] text-gray-400 px-1">Asisten AI Higo sedang mencocokkan menu...</span>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 shadow-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-green-600 animate-spin" />
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce"></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. FIXED BOTTOM INPUT BAR (Flat Sharp Messenger Style) */}
      <div className="shrink-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-2 sm:p-2.5 pb-3 sm:pb-3 pb-safe shadow-md">
        {/* VOICE RECORDING INDICATOR STRIP */}
        {isListening && (
          <div className="mb-2 p-2 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-100 animate-in fade-in rounded-none shadow-2xs">
            <div className="flex items-center gap-2 truncate">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
              </span>
              <span className="font-bold text-red-600 dark:text-red-400 shrink-0 flex items-center gap-1">
                <Mic className="w-3.5 h-3.5 animate-pulse" />
                Mendengarkan...
              </span>
              <span className="italic truncate font-medium text-gray-700 dark:text-gray-300">
                {voiceInterimText || 'Silakan bicara pesananmu sekarang...'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleVoice}
              className="text-[10px] font-black uppercase px-2 py-0.5 bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer rounded-none shrink-0"
            >
              Selesai Bicara
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-1.5"
        >
          {/* Tombol Voice Ordering (Mic) */}
          <button
            type="button"
            onClick={handleToggleVoice}
            disabled={chatMutation.isPending}
            className={`p-2 rounded-none border text-xs flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              isListening
                ? 'bg-red-600 border-red-700 text-white animate-pulse shadow-xs ring-1 ring-red-400'
                : 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 active:scale-95'
            }`}
            title={isListening ? 'Berhenti Merekam Suara' : 'Pesan via Suara (Voice Ordering)'}
          >
            {isListening ? (
              <MicOff className="w-4 h-4 text-white" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={chatMutation.isPending}
              placeholder={isListening ? 'Sedang mendengarkan suaramu...' : 'Ketik atau klik tombol Mic untuk pesan via suara...'}
              className={`w-full bg-slate-50 dark:bg-gray-800 border text-xs sm:text-[13px] text-gray-900 dark:text-white px-3 py-2 rounded-none outline-none focus:border-green-600 focus:bg-white dark:focus:bg-gray-900 transition-all placeholder:text-gray-400 ${
                isListening ? 'border-red-400 dark:border-red-600 ring-1 ring-red-400' : 'border-gray-300 dark:border-gray-700'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={!inputMessage.trim() || chatMutation.isPending}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold px-3.5 py-2 rounded-none text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs active:scale-95"
            title="Kirim Pesan"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Kirim</span>
          </button>
        </form>
        <p className="text-[9.5px] text-gray-400 text-center mt-1 truncate">
          🎙️ Mendukung Pemesanan Suara (Voice) • Didukung Gemini AI & Katalog Kantin Real-time
        </p>
      </div>

      {/* 4. MODAL POPUP PUSAT BANTUAN & KONTAK LANGSUNG (FLAT SHARP ROUNDED-NONE HIGH DENSITY) */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl rounded-none">
            {/* Modal Header */}
            <div className="px-3 py-2.5 bg-green-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4" />
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider">
                  Pusat Bantuan & Kontak Langsung
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                className="p-1 hover:bg-green-700 text-white rounded-none cursor-pointer transition-colors"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3 sm:p-4 overflow-y-auto space-y-3 text-xs">
              {/* Section 1: Admin Pondok */}
              <div className="border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 p-2.5 rounded-none">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    Admin Layanan HiGO Pondok
                  </span>
                  <span className="text-[9.5px] px-1.5 py-0.2 bg-emerald-600 text-white font-bold">
                    ONLINE
                  </span>
                </div>
                <div className="text-sm font-black text-gray-900 dark:text-white">
                  {supportData?.admin?.name || 'Admin Pengelola Pondok'}
                </div>
                <div className="text-[11px] text-gray-600 dark:text-gray-300 font-mono mt-0.5">
                  WhatsApp: {supportData?.admin?.phone || '081234567890'}
                </div>
                <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-1">
                  Hubungi admin jika ada kendala pengantaran santri, komplain kurir, saldo, atau bantuan sistem.
                </p>
                <a
                  href={supportData?.admin?.wa_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 text-xs text-center flex items-center justify-center gap-1.5 rounded-none transition-colors shadow-2xs cursor-pointer active:scale-[0.99]"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat WhatsApp Admin Sekarang</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              </div>

              {/* Section 2: Pilih & Chat Toko / Kantin */}
              <div className="border border-gray-200 dark:border-gray-800 p-2.5 rounded-none bg-gray-50 dark:bg-gray-800/40 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-green-700 dark:text-green-400 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-green-600" />
                  Kontak Langsung Toko & Kantin
                </div>
                <p className="text-[10.5px] text-gray-500 dark:text-gray-400 leading-tight">
                  Pilih toko untuk menanyakan ketersediaan menu, permintaan resep khusus, atau detail pesanan:
                </p>

                {/* Select Toko */}
                <div>
                  <label className="text-[10px] font-bold text-gray-600 dark:text-gray-300 block mb-1">
                    Pilih Toko / Kantin:
                  </label>
                  <select
                    value={selectedCanteenId || (supportData?.canteen?.id || '')}
                    onChange={(e) => setSelectedCanteenId(Number(e.target.value))}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-xs px-2.5 py-1.5 rounded-none outline-none focus:border-green-600 text-gray-800 dark:text-gray-200"
                  >
                    {supportData?.all_canteens?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.category ? `(${c.category})` : ''} - {c.phone}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Toko Terpilih Preview */}
                {(() => {
                  const currentCanteen = supportData?.all_canteens?.find(
                    (c) => c.id === (selectedCanteenId || supportData?.canteen?.id)
                  ) || supportData?.canteen;

                  if (!currentCanteen) return null;

                  return (
                    <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-gray-800 dark:text-gray-200 truncate">
                          {currentCanteen.name}
                        </span>
                        <span className="font-mono text-green-700 dark:text-green-400 font-bold">
                          {currentCanteen.phone}
                        </span>
                      </div>
                      <a
                        href={currentCanteen.wa_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-2 px-3 text-xs text-center flex items-center justify-center gap-1.5 rounded-none transition-colors shadow-2xs cursor-pointer active:scale-[0.99]"
                      >
                        <Store className="w-3.5 h-3.5" />
                        <span>Chat WhatsApp Toko ({currentCanteen.name})</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>
                    </div>
                  );
                })()}
              </div>

              {/* Info Jam Layanan */}
              <div className="p-2 bg-gray-100 dark:bg-gray-800/80 text-[10.5px] text-gray-600 dark:text-gray-400 flex items-start gap-1.5 border border-gray-200 dark:border-gray-700">
                <HelpCircle className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" />
                <span>
                  Layanan chat langsung diarahkan ke nomor WhatsApp resmi masing-masing pengelola toko atau admin pondok.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(false)}
                className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-none transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
