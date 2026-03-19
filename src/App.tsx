import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  Search, 
  Filter, 
  X, 
  Edit3, 
  ChevronDown,
  ShoppingBasket,
  LogOut,
  LogIn,
  Loader2,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';

// --- Types ---

type Category = 'Produce' | 'Dairy' | 'Meat' | 'Bakery' | 'Frozen' | 'Pantry' | 'Household' | 'Other';

interface GroceryItem {
  id: string;
  name: string;
  note?: string;
  category: Category;
  purchased: boolean;
  created_at: string;
  user_id: string;
}

const CATEGORIES: Category[] = [
  'Produce', 'Dairy', 'Meat', 'Bakery', 'Frozen', 'Pantry', 'Household', 'Other'
];

const CATEGORY_COLORS: Record<Category, string> = {
  Produce: 'bg-emerald-100 text-emerald-700',
  Dairy: 'bg-blue-100 text-blue-700',
  Meat: 'bg-red-100 text-red-700',
  Bakery: 'bg-amber-100 text-amber-700',
  Frozen: 'bg-cyan-100 text-cyan-700',
  Pantry: 'bg-stone-100 text-stone-700',
  Household: 'bg-purple-100 text-purple-700',
  Other: 'bg-zinc-100 text-zinc-700',
};

// --- App Component ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [newItemName, setNewItemName] = useState('');
  const [newItemNote, setNewItemNote] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<Category>('Produce');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'All'>('All');
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null);

  // Auth State
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Items
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    const fetchItems = async () => {
      const { data, error } = await supabase
        .from('grocery_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching items:', error);
      } else {
        setItems(data || []);
      }
    };

    fetchItems();

    // Real-time subscription
    const channel = supabase
      .channel('grocery_items_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grocery_items' }, () => {
        fetchItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Auth Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Grocery Handlers
  const seedData = async () => {
    if (!user) return;
    const sampleItems = [
      { name: 'Whole Milk', note: '2 Liters, Organic', category: 'Dairy', user_id: user.id },
      { name: 'Avocados', note: '3 ripe ones', category: 'Produce', user_id: user.id },
      { name: 'Chicken Breast', note: '1kg pack', category: 'Meat', user_id: user.id },
      { name: 'Sourdough Bread', note: 'Freshly baked', category: 'Bakery', user_id: user.id },
      { name: 'Frozen Peas', note: 'Large bag', category: 'Frozen', user_id: user.id },
      { name: 'Pasta', note: 'Penne or Fusilli', category: 'Pantry', user_id: user.id },
      { name: 'Dish Soap', note: 'Lemon scent', category: 'Household', user_id: user.id },
    ];

    const { error } = await supabase
      .from('grocery_items')
      .insert(sampleItems);

    if (error) {
      console.error('Error seeding data:', error);
    }
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !user) return;

    const { error } = await supabase
      .from('grocery_items')
      .insert([{
        name: newItemName.trim(),
        note: newItemNote.trim() || null,
        category: newItemCategory,
        purchased: false,
        user_id: user.id
      }]);

    if (error) {
      console.error('Error adding item:', error);
    } else {
      setNewItemName('');
      setNewItemNote('');
      setIsAdding(false);
    }
  };

  const togglePurchased = async (item: GroceryItem) => {
    const { error } = await supabase
      .from('grocery_items')
      .update({ purchased: !item.purchased })
      .eq('id', item.id);

    if (error) console.error('Error toggling purchased:', error);
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase
      .from('grocery_items')
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting item:', error);
  };

  const clearPurchased = async () => {
    const { error } = await supabase
      .from('grocery_items')
      .delete()
      .eq('purchased', true);

    if (error) console.error('Error clearing purchased:', error);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name.trim()) return;

    const { error } = await supabase
      .from('grocery_items')
      .update({
        name: editingItem.name.trim(),
        note: editingItem.note?.trim() || null,
        category: editingItem.category
      })
      .eq('id', editingItem.id);

    if (error) {
      console.error('Error saving edit:', error);
    } else {
      setEditingItem(null);
    }
  };

  // Filtered & Sorted Items
  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             (item.note?.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (a.purchased !== b.purchased) return a.purchased ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [items, searchQuery, filterCategory]);

  const stats = {
    total: items.length,
    purchased: items.filter(i => i.purchased).length,
    remaining: items.filter(i => !i.purchased).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl border border-zinc-200"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="bg-emerald-600 p-4 rounded-2xl shadow-lg shadow-emerald-200 mb-4">
              <ShoppingBasket className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome to FreshList</h1>
            <p className="text-zinc-500 text-sm">Sign in to manage your family grocery list</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Email Address</label>
              <input 
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="family@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Password</label>
              <input 
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg">
                {authError}
              </div>
            )}

            <button 
              type="submit"
              disabled={authLoading}
              className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              Sign In
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-xl shadow-lg shadow-emerald-200">
              <ShoppingBasket className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">FreshList</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-full">
              <UserIcon className="w-3 h-3 text-zinc-500" />
              <span className="text-[10px] font-medium text-zinc-600 truncate max-w-[100px]">{user.email}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold mb-1">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold mb-1">Remaining</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.remaining}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold mb-1">Done</p>
            <p className="text-2xl font-bold text-zinc-400">{stats.purchased}</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
            />
          </div>
          <div className="relative min-w-[140px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as Category | 'All')}
              className="w-full pl-10 pr-8 py-2.5 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm appearance-none cursor-pointer"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`group bg-white p-4 rounded-2xl border transition-all duration-200 flex items-start gap-4 ${
                  item.purchased 
                    ? 'border-zinc-100 opacity-60' 
                    : 'border-zinc-200 hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-500/5'
                }`}
              >
                <button 
                  onClick={() => togglePurchased(item)}
                  className={`mt-0.5 transition-colors ${item.purchased ? 'text-emerald-500' : 'text-zinc-300 hover:text-emerald-500'}`}
                >
                  {item.purchased ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-semibold text-sm truncate ${item.purchased ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
                      {item.name}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category]}`}>
                      {item.category}
                    </span>
                  </div>
                  {item.note && (
                    <p className={`text-xs truncate ${item.purchased ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {item.note}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setEditingItem(item)}
                    className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredItems.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-200">
              <div className="bg-zinc-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBasket className="w-8 h-8 text-zinc-300" />
              </div>
              <h3 className="text-zinc-900 font-semibold mb-1">No items found</h3>
              <p className="text-zinc-500 text-sm mb-6">Start by adding something to your list</p>
              <button 
                onClick={seedData}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-semibold hover:bg-emerald-100 transition-colors border border-emerald-100"
              >
                <Plus className="w-4 h-4" />
                Seed Sample Items
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add Button (Floating) */}
      {!isAdding && (
        <button 
          onClick={() => setIsAdding(true)}
          className="fixed bottom-8 right-8 bg-emerald-600 text-white p-4 rounded-2xl shadow-xl shadow-emerald-500/40 hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all z-20"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Add New Item</h2>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <form onSubmit={addItem} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Item Name</label>
                  <input 
                    autoFocus
                    type="text"
                    required
                    placeholder="e.g. Whole Milk"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Category</label>
                  <div className="grid grid-cols-4 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewItemCategory(cat)}
                        className={`text-[10px] py-2 rounded-lg font-medium border transition-all ${
                          newItemCategory === cat 
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200' 
                            : 'bg-white border-zinc-200 text-zinc-600 hover:border-emerald-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Note (Optional)</label>
                  <textarea 
                    placeholder="e.g. 2 liters, organic"
                    value={newItemNote}
                    onChange={(e) => setNewItemNote(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all mt-2"
                >
                  Add to List
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingItem(null)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Edit Item</h2>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <form onSubmit={saveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Item Name</label>
                  <input 
                    autoFocus
                    type="text"
                    required
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Category</label>
                  <div className="grid grid-cols-4 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setEditingItem({ ...editingItem, category: cat })}
                        className={`text-[10px] py-2 rounded-lg font-medium border transition-all ${
                          editingItem.category === cat 
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200' 
                            : 'bg-white border-zinc-200 text-zinc-600 hover:border-emerald-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Note (Optional)</label>
                  <textarea 
                    value={editingItem.note || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, note: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3 mt-2">
                  <button 
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="flex-1 bg-zinc-100 text-zinc-600 py-4 rounded-xl font-bold hover:bg-zinc-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
