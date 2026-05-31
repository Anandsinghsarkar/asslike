import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, onAuthStateChanged, deleteUser 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, getDocs, 
  addDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, writeBatch, increment
} from 'firebase/firestore';
import { 
  MessageCircle, Users, UserPlus, Settings, User, Image as ImageIcon, 
  Send, ArrowLeft, Check, CheckCheck, Clock, LogOut, Trash2, Edit2, Camera,
  MoreVertical, X, Trash, Edit3, Ban, Smile, Paperclip
} from 'lucide-react';

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAsGtblJRafRcfPDxSwXIlklMqBSKfo8Eo",
  authDomain: "asprivetchat.firebaseapp.com",
  projectId: "asprivetchat",
  storageBucket: "asprivetchat.firebasestorage.app",
  messagingSenderId: "232125473382",
  appId: "1:232125473382:web:ae3aa39cfd9febc92803a7",
  measurementId: "G-8LXNRN5SX4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- UTILITY FUNCTIONS ---
const processImage = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        canvas.width = 300; 
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;
        ctx.drawImage(img, startX, startY, size, size, 0, 0, 300, 300);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

const processChatImage = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 800; // Limit size for fast transfer
        let { width, height } = img;
        if (width > height) {
          if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; }
        } else {
          if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

const formatTimeOnly = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date)) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatLastSeen = (timestamp) => {
  if (!timestamp) return '...';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date)) return '...';
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (date.toDateString() === today.toDateString()) {
    return `aaj ${timeStr} par`;
  } else if (date.toDateString() === yesterday.toDateString()) {
    return `kal ${timeStr} par`;
  } else {
    return `${date.toLocaleDateString()} ko ${timeStr} par`;
  }
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl scale-100 transition-transform">
        <h3 className="text-xl font-bold mb-2 text-gray-800">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition">Confirm</button>
        </div>
      </div>
    </div>
  );
};


// --- SCREENS ---
const AuthScreen = ({ auth, db, showToast }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '', username: '', email: '', dob: '', gender: 'Male', password: '', confirmPassword: ''
  });
  const [profilePic, setProfilePic] = useState(null);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    const base64 = await processImage(file);
    setProfilePic(base64);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        let loginEmail = formData.email;
        if (!loginEmail.includes('@')) {
          const usersSnap = await getDocs(collection(db, 'users'));
          const userDoc = usersSnap.docs.map(d => d.data()).find(u => u.username === formData.email || u.id === formData.email);
          if (userDoc) loginEmail = userDoc.email;
          else throw new Error("Username ya User ID nahi mila");
        }
        await signInWithEmailAndPassword(auth, loginEmail, formData.password);
        showToast("Login successful!", "success");
      } else {
        if (formData.password !== formData.confirmPassword) throw new Error("Password match nahi hua");
        
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersList = usersSnap.docs.map(d => d.data());
        if (usersList.some(u => u.username.toLowerCase() === formData.username.toLowerCase())) {
          throw new Error("Yeh Username pehle se kisi aur ne le liya hai, dusra try karein.");
        }

        const userCred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        
        await setDoc(doc(db, 'users', userCred.user.uid), {
          id: userCred.user.uid,
          name: formData.name,
          username: formData.username,
          email: formData.email,
          dob: formData.dob, 
          gender: formData.gender, 
          profilePic: profilePic || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
          bio: "Hey there! I am using As Like.",
          isOnline: true,
          lastSeen: serverTimestamp(),
          typingTo: null
        });
        showToast("Account ban gaya!", "success");
      }
    } catch (error) {
      showToast(error.message, "error");
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex justify-center mb-6 text-green-500">
          <MessageCircle size={48} />
        </div>
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          {isLogin ? 'Login Karein' : 'Naya Account Banayein'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="flex justify-center mb-4 relative">
                <label className="cursor-pointer group relative">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                    {profilePic ? (
                      <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-gray-500">
                        <Camera size={24} className="mx-auto mb-1" />
                        <span className="text-xs">Photo</span>
                      </div>
                    )}
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                </label>
              </div>
              <input type="text" name="name" placeholder="Pura Naam" required className="w-full p-3 border rounded-lg" onChange={handleChange} />
              <input type="text" name="username" placeholder="Username (Unique)" required className="w-full p-3 border rounded-lg" onChange={handleChange} />
              <input type="date" name="dob" required className="w-full p-3 border rounded-lg" onChange={handleChange} />
              <select name="gender" className="w-full p-3 border rounded-lg" onChange={handleChange}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </>
          )}
          
          <input 
            type={isLogin ? "text" : "email"} 
            name="email" 
            placeholder={isLogin ? "Email, Username ya UserID" : "Email Address"} 
            required className="w-full p-3 border rounded-lg" onChange={handleChange} 
          />
          <input type="password" name="password" placeholder="Password" required className="w-full p-3 border rounded-lg" onChange={handleChange} />
          
          {!isLogin && (
            <input type="password" name="confirmPassword" placeholder="Confirm Password" required className="w-full p-3 border rounded-lg" onChange={handleChange} />
          )}

          <button disabled={loading} type="submit" className="w-full bg-green-500 text-white p-3 rounded-lg font-bold hover:bg-green-600 transition">
            {loading ? 'Thoda intezaar karein...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <p className="text-center mt-4 text-gray-600">
          {isLogin ? "Account nahi hai?" : "Pehle se account hai?"} 
          <button className="text-green-500 font-bold ml-1" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Yahan banayein" : "Login karein"}
          </button>
        </p>
      </div>
    </div>
  );
};

const HomeScreen = ({ currentUser, userData, db, setCurrentView, chats, allUsers, requests, setActiveChatUser, setViewProfileUser }) => {
  const [tab, setTab] = useState('chats');

  const startChat = (user) => {
    setActiveChatUser(user);
    setCurrentView('chat');
  };

  const handleProfileClick = (user) => {
    setViewProfileUser(user);
    setCurrentView('profile');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-3xl mx-auto shadow-2xl relative">
      <div className="bg-green-600 text-white p-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold tracking-wide">As Like</h1>
        <div className="flex gap-4 items-center">
          <button onClick={() => setCurrentView('settings')}><Settings size={22} /></button>
          <button onClick={() => setCurrentView('editProfile')} className="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm">
            <img src={userData?.profilePic || 'https://www.gravatar.com/avatar/?d=mp'} alt="Me" className="w-full h-full object-cover" />
          </button>
        </div>
      </div>

      <div className="flex bg-green-600 text-white border-t border-green-700 shadow-md z-10">
        <button className={`flex-1 p-3 text-center font-medium ${tab === 'chats' ? 'border-b-4 border-white' : 'text-green-200'}`} onClick={() => setTab('chats')}>Chats</button>
        <button className={`flex-1 p-3 text-center font-medium ${tab === 'users' ? 'border-b-4 border-white' : 'text-green-200'}`} onClick={() => setTab('users')}>Sabhi Users</button>
        <button className={`flex-1 p-3 text-center font-medium ${tab === 'requests' ? 'border-b-4 border-white' : 'text-green-200'}`} onClick={() => setTab('requests')}>Requests</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'chats' && (
          <div className="divide-y divide-gray-100">
            {chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center mt-20 text-gray-400">
                <MessageCircle size={48} className="mb-4 opacity-50" />
                <p>Koi chat nahi. Nayi chat shuru karein.</p>
              </div>
            ) : null}
            
            {chats.map(chat => {
              const otherUserId = chat.participants.find(id => id !== currentUser.uid);
              const otherUser = allUsers.find(u => u.id === otherUserId);
              if (!otherUser) return null;
              
              const myClearedAt = chat.clearedAt?.[currentUser.uid]?.toMillis() || 0;
              const lastMsgTime = chat.lastMessageTime?.toMillis() || 0;
              const unreadCount = chat.unreadCount?.[currentUser.uid] || 0;
              
              let displayMsg = chat.lastMessage;
              if (myClearedAt >= lastMsgTime) {
                displayMsg = null;
              } else if (chat.lastMessage === 'isDeleted') {
                displayMsg = '🚫 Unsend';
              }

              return (
                <div key={chat.id} className="flex items-center p-4 hover:bg-gray-100 cursor-pointer transition" onClick={() => startChat(otherUser)}>
                  <div className="relative">
                     <img src={otherUser.profilePic} onClick={(e)=>{e.stopPropagation(); handleProfileClick(otherUser)}} alt="" className="w-12 h-12 rounded-full object-cover mr-4 cursor-pointer border border-gray-200" />
                     {otherUser.isOnline && <div className="absolute bottom-0 right-4 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-end mb-1">
                      <h3 className="font-bold text-gray-800 truncate">{otherUser.name}</h3>
                      <span className={`text-xs whitespace-nowrap ml-2 ${unreadCount > 0 ? 'text-green-500 font-bold' : 'text-gray-500'}`}>
                        {displayMsg ? formatTimeOnly(chat.lastMessageTime) : ''}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <p className={`text-sm truncate ${displayMsg?.includes('🚫') ? 'text-gray-400 italic' : 'text-gray-600'} ${unreadCount > 0 ? 'font-semibold text-gray-800' : ''}`}>
                        {displayMsg || 'Batein shuru karein...'}
                      </p>
                      
                      {unreadCount > 0 && (
                        <div className="bg-green-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center ml-2 shadow-sm">
                          {unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'users' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4">
            {allUsers.map(user => (
              <div key={user.id} className="bg-white p-4 rounded-xl shadow text-center flex flex-col items-center">
                <div className="relative">
                  <img src={user.profilePic} onClick={() => handleProfileClick(user)} alt="" className="w-20 h-20 rounded-full object-cover mb-2 cursor-pointer border-2 border-green-500 p-1" />
                  {user.isOnline && <div className="absolute bottom-3 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>}
                </div>
                <h3 className="font-bold text-gray-800 truncate w-full">{user.name}</h3>
                <p className="text-xs text-gray-500 mb-3">@{user.username}</p>
                <div className="flex gap-2 w-full">
                  <button onClick={() => startChat(user)} className="flex-1 bg-green-100 text-green-700 py-2 rounded-lg flex justify-center hover:bg-green-200">
                    <MessageCircle size={18} />
                  </button>
                  <button onClick={() => handleProfileClick(user)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg flex justify-center hover:bg-gray-200">
                    <User size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'requests' && (
          <div className="p-4 space-y-4">
            <h2 className="font-bold text-gray-700">Aayi hui requests:</h2>
            {requests.filter(r => r.receiverId === currentUser.uid && r.status === 'pending').length === 0 && <p className="text-gray-500 text-sm">Koi nayi request nahi.</p>}
            {requests.filter(r => r.receiverId === currentUser.uid && r.status === 'pending').map(req => {
              const sender = allUsers.find(u => u.id === req.senderId);
              if (!sender) return null;
              return (
                <div key={req.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow">
                  <div className="flex items-center" onClick={() => handleProfileClick(sender)}>
                    <img src={sender.profilePic} alt="" className="w-10 h-10 rounded-full mr-3 cursor-pointer" />
                    <div>
                      <p className="font-bold">{sender.name}</p>
                      <p className="text-xs text-gray-500">@{sender.username}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => await updateDoc(doc(db, 'requests', req.id), { status: 'accepted' })} className="bg-green-500 text-white px-3 py-1 rounded text-sm">Accept</button>
                    <button onClick={async () => await deleteDoc(doc(db, 'requests', req.id))} className="bg-red-500 text-white px-3 py-1 rounded text-sm">Reject</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const ChatScreen = ({ db, currentUser, activeChatUser, chats, setCurrentView, setViewProfileUser, showToast, showConfirm }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  
  const [msgMenuOpen, setMsgMenuOpen] = useState(null); 
  const [editingMsg, setEditingMsg] = useState(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);

  // Emoji States
  const [emojis, setEmojis] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  let chatDoc = chats.find(c => c.participants.includes(activeChatUser.id));
  let chatId = chatDoc?.id;
  const generateChatId = () => [currentUser.uid, activeChatUser.id].sort().join('_');
  if (!chatId) chatId = generateChatId();

  const myClearedAt = chatDoc?.clearedAt?.[currentUser.uid]?.toMillis() || 0;

  // Load ALL emojis from API as requested
  useEffect(() => {
    fetch('https://emoji-api.com/emojis?access_key=aa47fd6e6066769416bac5d75b381439fdee69e5')
      .then(res => res.json())
      .then(data => {
         if(data && data.length > 0) {
           setEmojis(data); // Displaying all fetched emojis without slicing
         }
      })
      .catch(err => console.error("Emoji load error:", err));
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'chats', chatId, 'messages'), (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      msgs.sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
      setMessages(msgs);

      // Blue Ticks Reset Logic
      const unreadMsgs = msgs.filter(m => m.senderId !== currentUser.uid && m.status !== 'read');
      if (unreadMsgs.length > 0) {
        const batch = writeBatch(db);
        unreadMsgs.forEach(m => {
          batch.update(doc(db, 'chats', chatId, 'messages', m.id), { status: 'read' });
        });
        batch.commit().catch(()=>{});
        
        setDoc(doc(db, 'chats', chatId), {
          [`unreadCount.${currentUser.uid}`]: 0
        }, { merge: true }).catch(()=>{});
      }

      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => {
      unsub();
      updateDoc(doc(db, 'users', currentUser.uid), { typingTo: null }).catch(()=>{});
    };
  }, [chatId, db, currentUser.uid]);

  const handleTyping = (e) => {
    setInput(e.target.value);
    
    if (!typingTimeoutRef.current) {
      updateDoc(doc(db, 'users', currentUser.uid), { typingTo: activeChatUser.id }).catch(()=>{});
    } else {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      updateDoc(doc(db, 'users', currentUser.uid), { typingTo: null }).catch(()=>{});
      typingTimeoutRef.current = null;
    }, 1500);
  };

  const addEmojiToInput = (emojiChar) => {
    setInput(prev => prev + emojiChar);
    // Removed auto-close for emoji picker to allow multiple selections easily
  };

  const handleImageSend = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    showToast("Sending image...", "info");
    const base64 = await processChatImage(file);
    if (!base64) return;

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      senderId: currentUser.uid,
      text: '',
      imageUrl: base64,
      timestamp: serverTimestamp(),
      status: 'sent',
      isEdited: false,
      deletedFor: []
    });

    await setDoc(doc(db, 'chats', chatId), {
      participants: [currentUser.uid, activeChatUser.id],
      lastMessage: '📷 Photo',
      lastMessageTime: serverTimestamp(),
      [`unreadCount.${activeChatUser.id}`]: increment(1)
    }, { merge: true });
    
    e.target.value = '';
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const text = input;
    setInput('');
    setShowEmojiPicker(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;
    updateDoc(doc(db, 'users', currentUser.uid), { typingTo: null }).catch(()=>{});

    if (editingMsg) {
      await updateDoc(doc(db, 'chats', chatId, 'messages', editingMsg.id), {
        text: text,
        isEdited: true
      });
      setEditingMsg(null);
      showToast('Message edit ho gaya', 'success');
      
      await setDoc(doc(db, 'chats', chatId), { lastMessage: text }, { merge: true });
      
    } else {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        senderId: currentUser.uid,
        text,
        timestamp: serverTimestamp(),
        status: 'sent', 
        isEdited: false,
        isDeleted: false,
        deletedFor: []
      });

      await setDoc(doc(db, 'chats', chatId), {
        participants: [currentUser.uid, activeChatUser.id],
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
        [`unreadCount.${activeChatUser.id}`]: increment(1)
      }, { merge: true });
    }
  };

  const initiateEdit = (msg) => {
    if(msg.imageUrl) return showToast("Image edit nahi ki ja sakti", "info");
    setEditingMsg(msg);
    setInput(msg.text);
    setMsgMenuOpen(null);
  };

  const cancelEdit = () => {
    setEditingMsg(null);
    setInput('');
  };

  const deleteForMe = async (msgId) => {
    await updateDoc(doc(db, 'chats', chatId, 'messages', msgId), {
      deletedFor: arrayUnion(currentUser.uid)
    });
    setMsgMenuOpen(null);
  };

  const deleteForEveryone = (msgId) => {
    showConfirm("Delete Message", "Kya aap is message ko sabhi ke liye delete karna chahte hain?", async () => {
      await updateDoc(doc(db, 'chats', chatId, 'messages', msgId), {
        isDeleted: true,
        text: ""
      });
      
      await setDoc(doc(db, 'chats', chatId), {
        lastMessage: "isDeleted",
        lastMessageTime: serverTimestamp() 
      }, { merge: true });

      setMsgMenuOpen(null);
    });
  };

  const clearChat = () => {
    showConfirm("Clear Chat", "Kya aap sach me apna chat clear karna chahte hain?", async () => {
      try {
        await setDoc(doc(db, 'chats', chatId), {
          clearedAt: {
            [currentUser.uid]: serverTimestamp() 
          }
        }, { merge: true });
        
        setChatMenuOpen(false);
        showToast('Chat clear ho gayi', 'success');
      } catch (e) {
        showToast('Clear karne me error aayi', 'error');
      }
    });
  };

  const isTyping = activeChatUser.typingTo === currentUser.uid;
  const isOnline = activeChatUser.isOnline;
  const lastSeenText = activeChatUser.lastSeen ? formatLastSeen(activeChatUser.lastSeen) : '...';

  const visibleMessages = messages.filter(m => {
    if (m.deletedFor?.includes(currentUser.uid)) return false;
    const msgTime = m.timestamp?.toMillis() || Date.now(); 
    if (myClearedAt && msgTime <= myClearedAt) return false;
    return true;
  });

  const renderTicks = (msg) => {
    if (msg.senderId !== currentUser.uid) return null; 
    
    if (msg.status === 'read') {
      return <CheckCheck size={14} className="text-blue-500 ml-1" />;
    }
    
    const msgTime = msg.timestamp?.toMillis() || 0;
    const otherUserLastSeen = activeChatUser.lastSeen?.toMillis() || 0;
    const isDelivered = activeChatUser.isOnline || (otherUserLastSeen > msgTime && otherUserLastSeen !== 0);
    
    if (isDelivered) {
      return <CheckCheck size={14} className="text-gray-400 ml-1" />;
    }
    return <Check size={14} className="text-gray-400 ml-1" />;
  };

  return (
    <div 
      className="flex flex-col h-screen bg-[#e5ddd5] max-w-3xl mx-auto shadow-2xl relative"
      onClick={() => { setMsgMenuOpen(null); setChatMenuOpen(false); setShowEmojiPicker(false); }} 
    >
      
      {/* Header */}
      <div className="bg-green-600 text-white p-3 flex items-center gap-3 shadow-md z-20">
        <button onClick={() => setCurrentView('home')}><ArrowLeft /></button>
        <img 
          src={activeChatUser.profilePic} 
          alt="Profile" 
          className="w-10 h-10 rounded-full object-cover cursor-pointer border border-green-700"
          onClick={() => { setViewProfileUser(activeChatUser); setCurrentView('profile'); }}
        />
        <div className="flex-1 cursor-pointer" onClick={() => { setViewProfileUser(activeChatUser); setCurrentView('profile'); }}>
          <h2 className="font-bold leading-tight">{activeChatUser.name}</h2>
          <p className="text-xs text-green-100 font-medium tracking-wide">
            {isTyping ? 'typing...' : (isOnline ? 'Online' : `last seen ${lastSeenText}`)}
          </p>
        </div>
        
        {/* Clear Chat Menu */}
        <div className="relative">
          <button onClick={(e) => { e.stopPropagation(); setChatMenuOpen(!chatMenuOpen); }} className="p-2">
            <MoreVertical size={20} />
          </button>
          {chatMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white text-gray-800 shadow-xl rounded-md z-50 overflow-hidden border border-gray-100">
              <button 
                onClick={clearChat} 
                className="w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-2 text-red-600 font-medium"
              >
                <Ban size={16} /> Clear Chat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 relative" style={{backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')"}}>
        {visibleMessages.length === 0 && (
           <p className="text-center text-gray-500 text-sm mt-10 bg-white/60 py-2 rounded max-w-[200px] mx-auto shadow-sm backdrop-blur">
             Messages end to end encrypted.
           </p>
        )}
        
        {visibleMessages.map((msg, idx) => {
          const isMe = msg.senderId === currentUser.uid;
          const showMenu = msgMenuOpen === msg.id;

          return (
            <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`relative max-w-[75%] p-2 rounded-lg shadow-sm cursor-pointer group ${isMe ? 'bg-[#dcf8c6]' : 'bg-white'}`}
                onClick={(e) => { e.stopPropagation(); setMsgMenuOpen(msgMenuOpen === msg.id ? null : msg.id); }}
              >
                
                {msg.imageUrl && !msg.isDeleted && (
                  <img src={msg.imageUrl} alt="Shared" className="rounded-lg max-w-full mb-1 h-auto cursor-pointer" style={{maxHeight: '300px'}} />
                )}
                
                <p className={`text-gray-800 break-words text-[15px] ${msg.isDeleted ? 'italic text-gray-500 text-sm' : ''}`}>
                  {msg.isDeleted ? '🚫 Unsend' : msg.text}
                </p>
                
                <div className="flex items-center justify-end gap-1 mt-1">
                  {msg.isEdited && !msg.isDeleted && <span className="text-[10px] text-gray-400 italic">(edited)</span>}
                  <p className="text-[10px] text-gray-500 flex items-center">
                    {formatTimeOnly(msg.timestamp)}
                    {!msg.isDeleted && renderTicks(msg)}
                  </p>
                </div>

                {/* Message Dropdown Menu */}
                {showMenu && (
                  <div className={`absolute top-full mt-1 w-48 bg-white text-gray-800 shadow-2xl rounded-md z-50 overflow-hidden border border-gray-200 ${isMe ? 'right-0' : 'left-0'}`}>
                    
                    {!msg.isDeleted && isMe && !msg.imageUrl && (
                      <button onClick={() => initiateEdit(msg)} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm border-b font-medium">
                        <Edit3 size={16} /> Edit Message
                      </button>
                    )}
                    
                    {!msg.isDeleted && isMe && (
                      <button onClick={() => deleteForEveryone(msg.id)} className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-sm border-b text-red-600 font-medium">
                        <Trash size={16} /> Unsend
                      </button>
                    )}

                    <button onClick={() => deleteForMe(msg.id)} className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-sm text-gray-700 font-medium">
                      <Trash2 size={16} /> Delete for me
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-[70px] left-2 bg-white border border-gray-200 shadow-xl rounded-lg w-72 h-64 overflow-y-auto p-2 z-50 flex flex-wrap gap-1 content-start" onClick={e=>e.stopPropagation()}>
          {emojis.length > 0 ? emojis.map((em, i) => (
            <span key={i} className="text-2xl cursor-pointer hover:bg-gray-100 p-1 rounded transition" onClick={() => addEmojiToInput(em.character)}>
              {em.character}
            </span>
          )) : (
            <p className="w-full text-center text-sm text-gray-500 mt-10">Emojis load ho rahe hain...</p>
          )}
        </div>
      )}

      {/* Input Area */}
      <div 
        className="bg-gray-100 p-2 flex flex-col relative z-40"
        onClick={(e) => e.stopPropagation()} 
      >
        {editingMsg && (
          <div className="bg-green-100 px-4 py-2 rounded-t-lg border-l-4 border-green-500 flex justify-between items-center text-sm shadow-sm">
            <div>
              <span className="font-bold text-green-700">Editing Message</span>
              <p className="text-gray-600 truncate max-w-[200px]">{editingMsg.text}</p>
            </div>
            <button onClick={cancelEdit} className="text-gray-500 hover:text-red-500"><X size={18} /></button>
          </div>
        )}
        
        <form onSubmit={sendMessage} className={`flex items-center gap-2 ${editingMsg ? 'pt-2' : ''}`}>
          
          <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-gray-500 hover:text-green-600 transition">
            <Smile size={24} />
          </button>

          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSend} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-green-600 transition">
            <Paperclip size={24} />
          </button>

          <input 
            type="text" 
            value={input} 
            onChange={handleTyping}
            placeholder={editingMsg ? "Message edit karein..." : "Message type karein..."} 
            className="flex-1 px-4 py-3 rounded-full border-none focus:ring-2 focus:ring-green-400 outline-none shadow-sm text-gray-800"
          />
          <button type="submit" className="bg-green-600 text-white w-12 h-12 rounded-full hover:bg-green-700 flex items-center justify-center shadow-md flex-shrink-0 transition-transform active:scale-95">
            {editingMsg ? <Check size={20} /> : <Send size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};

const ProfileViewScreen = ({ db, currentUser, viewProfileUser, requests, setCurrentView, setActiveChatUser, showToast }) => {
  const isMe = viewProfileUser.id === currentUser.uid;
  const reqStatus = requests.find(r => 
    (r.senderId === currentUser.uid && r.receiverId === viewProfileUser.id) || 
    (r.receiverId === currentUser.uid && r.senderId === viewProfileUser.id)
  );

  const handleRequest = async () => {
    if (reqStatus) return; 
    await addDoc(collection(db, 'requests'), {
      senderId: currentUser.uid,
      receiverId: viewProfileUser.id,
      status: 'pending',
      timestamp: serverTimestamp()
    });
    showToast('Request bhej di gayi hai', 'success');
  };

  const isOnline = viewProfileUser.isOnline;
  const lastSeenText = viewProfileUser.lastSeen ? formatLastSeen(viewProfileUser.lastSeen) : '...';

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-3xl mx-auto shadow-2xl">
      <div className="bg-green-600 text-white p-4 flex items-center gap-4 shadow-md">
        <button onClick={() => setCurrentView('home')}><ArrowLeft /></button>
        <h1 className="text-xl font-bold">Profile</h1>
      </div>

      <div className="flex flex-col items-center mt-8 p-4">
        <div className="relative">
          <img src={viewProfileUser.profilePic} alt="" className="w-40 h-40 rounded-full object-cover border-4 border-green-500 shadow-lg mb-4" />
          {isOnline && <div className="absolute bottom-6 right-3 w-6 h-6 bg-green-500 border-4 border-gray-50 rounded-full"></div>}
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          {viewProfileUser.name}
        </h2>
        <p className="text-gray-500">@{viewProfileUser.username}</p>
        
        <p className={`text-sm mt-1 font-medium ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
           {isOnline ? 'Online' : `Last seen ${lastSeenText}`}
        </p>

        <div className="bg-white w-full p-4 rounded-xl mt-6 shadow text-center">
          <h3 className="text-sm text-gray-500 font-bold mb-1">About (Bio)</h3>
          <p className="text-gray-800">{viewProfileUser.bio || "No bio available."}</p>
        </div>

        {!isMe && (
          <div className="flex gap-4 mt-8 w-full">
            <button 
              onClick={() => { setActiveChatUser(viewProfileUser); setCurrentView('chat'); }} 
              className="flex-1 bg-green-500 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow hover:bg-green-600 transition"
            >
              <MessageCircle /> Message Karein
            </button>
            
            <button 
              onClick={handleRequest}
              disabled={!!reqStatus}
              className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow text-white transition ${reqStatus ? (reqStatus.status === 'accepted' ? 'bg-blue-500' : 'bg-yellow-500') : 'bg-indigo-500'}`}
            >
              <UserPlus /> 
              {reqStatus ? (reqStatus.status === 'accepted' ? 'Friends' : 'Requested') : 'Request Bhejein'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const EditProfileScreen = ({ db, currentUser, userData, setCurrentView, showToast }) => {
  const [name, setName] = useState(userData?.name || '');
  const [bio, setBio] = useState(userData?.bio || '');
  const [pic, setPic] = useState(userData?.profilePic || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await updateDoc(doc(db, 'users', currentUser.uid), { name, bio, profilePic: pic });
    setSaving(false);
    showToast('Profile update ho gayi!', 'success');
    setCurrentView('home');
  };

  const changePic = async (e) => {
    const base64 = await processImage(e.target.files[0]);
    if(base64) setPic(base64);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-3xl mx-auto shadow-2xl">
      <div className="bg-green-600 text-white p-4 flex items-center gap-4">
        <button onClick={() => setCurrentView('home')}><ArrowLeft /></button>
        <h1 className="text-xl font-bold">Profile Edit Karein</h1>
      </div>
      
      <div className="p-6 flex flex-col items-center">
        <label className="relative cursor-pointer mb-6 group">
          <img src={pic || 'https://www.gravatar.com/avatar/?d=mp'} alt="" className="w-32 h-32 rounded-full object-cover border-2 border-gray-300" />
          <div className="absolute inset-0 bg-black bg-opacity-40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
            <Camera className="text-white" />
          </div>
          <input type="file" className="hidden" accept="image/*" onChange={changePic} />
        </label>

        <div className="w-full space-y-4">
          <div>
            <label className="text-xs text-gray-500 font-bold">Naam</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 border rounded border-gray-300 focus:border-green-500 outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-bold">Bio</label>
            <input type="text" value={bio} onChange={e => setBio(e.target.value)} className="w-full p-3 border rounded border-gray-300 focus:border-green-500 outline-none" />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} className="mt-8 w-full bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 shadow transition">
          {saving ? 'Saving...' : 'Save Karein'}
        </button>
      </div>
    </div>
  );
};

const SettingsScreen = ({ auth, db, currentUser, setCurrentView, showToast, showConfirm }) => {
  const handleLogout = async () => {
    await updateDoc(doc(db, 'users', currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() }).catch(()=>{});
    await signOut(auth);
  };

  const handleDeleteAccount = () => {
    showConfirm("Account Delete", "Kya aap sach me apna account hamesha ke liye delete karna chahte hain? Data recover nahi hoga.", async () => {
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid));
        await deleteUser(currentUser);
        showToast('Account delete ho gaya.', 'success');
      } catch (error) {
        showToast('Error: Please dubara login karein delete karne se pehle.', 'error');
      }
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-3xl mx-auto shadow-2xl">
      <div className="bg-green-600 text-white p-4 flex items-center gap-4">
        <button onClick={() => setCurrentView('home')}><ArrowLeft /></button>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>
      
      <div className="p-4 space-y-2">
        <button onClick={() => setCurrentView('editProfile')} className="w-full flex items-center p-4 bg-white rounded-lg shadow-sm gap-4 text-gray-700 hover:bg-gray-100 transition">
          <Edit2 size={20} /> <span className="font-medium">Profile Update Karein</span>
        </button>
        
        <button onClick={handleLogout} className="w-full flex items-center p-4 bg-white rounded-lg shadow-sm gap-4 text-gray-700 hover:bg-gray-100 transition">
          <LogOut size={20} /> <span className="font-medium">Log Out</span>
        </button>

        <button onClick={handleDeleteAccount} className="w-full flex items-center p-4 bg-white rounded-lg shadow-sm gap-4 text-red-600 hover:bg-red-50 mt-8 transition">
          <Trash2 size={20} /> <span className="font-medium">Account Delete Karein</span>
        </button>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [currentView, setCurrentView] = useState('login'); 
  
  const [allUsers, setAllUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [requests, setRequests] = useState([]);
  
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [viewProfileUser, setViewProfileUser] = useState(null);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const showConfirm = (title, message, onConfirmCallback) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirmCallback();
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  const closeConfirm = () => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (currentUser) {
        if (document.hidden) {
          updateDoc(doc(db, 'users', currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() }).catch(()=>{});
        } else {
          updateDoc(doc(db, 'users', currentUser.uid), { isOnline: true }).catch(()=>{});
        }
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [currentUser]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        updateDoc(doc(db, 'users', user.uid), { isOnline: true, lastSeen: serverTimestamp() }).catch(()=>{});
        setCurrentView('home');
      } else {
        setUserData(null);
        setCurrentView('login');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentUser) {
        updateDoc(doc(db, 'users', currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() }).catch(()=>{});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const unsubUser = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
      if (docSnap.exists()) setUserData(docSnap.data());
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(usersList.filter(u => u.id !== currentUser.uid)); 
    });

    const unsubChats = onSnapshot(collection(db, 'chats'), (snapshot) => {
      const chatsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const myChats = chatsList.filter(c => c.participants.includes(currentUser.uid));
      setChats(myChats);
    });

    const unsubRequests = onSnapshot(collection(db, 'requests'), (snapshot) => {
      const reqList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const myRequests = reqList.filter(r => r.receiverId === currentUser.uid || r.senderId === currentUser.uid);
      setRequests(myRequests);
    });

    return () => { unsubUser(); unsubUsers(); unsubChats(); unsubRequests(); };
  }, [currentUser]);

  const liveActiveChatUser = activeChatUser ? (allUsers.find(u => u.id === activeChatUser.id) || activeChatUser) : null;
  const liveViewProfileUser = viewProfileUser ? (allUsers.find(u => u.id === viewProfileUser.id) || viewProfileUser) : null;

  return (
    <div className="font-sans antialiased text-gray-900 bg-gray-200 min-h-screen relative">
      {toast && (
        <div className={`fixed top-4 right-4 z-[200] p-4 rounded shadow-lg text-white font-bold transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmDialog.isOpen} 
        title={confirmDialog.title} 
        message={confirmDialog.message} 
        onConfirm={confirmDialog.onConfirm} 
        onCancel={closeConfirm} 
      />

      {currentView === 'login' && <AuthScreen auth={auth} db={db} showToast={showToast} />}
      
      {currentView === 'home' && userData && (
        <HomeScreen 
          db={db} currentUser={currentUser} userData={userData} 
          allUsers={allUsers} chats={chats} requests={requests} 
          setCurrentView={setCurrentView} setActiveChatUser={setActiveChatUser} 
          setViewProfileUser={setViewProfileUser} 
        />
      )}
      
      {currentView === 'chat' && liveActiveChatUser && (
        <ChatScreen 
          db={db} currentUser={currentUser} activeChatUser={liveActiveChatUser} 
          chats={chats} setCurrentView={setCurrentView} setViewProfileUser={setViewProfileUser} 
          showToast={showToast} showConfirm={showConfirm}
        />
      )}
      
      {currentView === 'profile' && liveViewProfileUser && (
        <ProfileViewScreen 
          db={db} currentUser={currentUser} viewProfileUser={liveViewProfileUser} 
          requests={requests} setCurrentView={setCurrentView} 
          setActiveChatUser={setActiveChatUser} showToast={showToast} 
        />
      )}
      
      {currentView === 'editProfile' && userData && (
        <EditProfileScreen 
          db={db} currentUser={currentUser} userData={userData} 
          setCurrentView={setCurrentView} showToast={showToast} 
        />
      )}
      
      {currentView === 'settings' && (
        <SettingsScreen 
          auth={auth} db={db} currentUser={currentUser} 
          setCurrentView={setCurrentView} showToast={showToast} showConfirm={showConfirm}
        />
      )}
    </div>
  );
}