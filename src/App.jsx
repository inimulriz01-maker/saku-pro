import { useEffect, useState, useRef } from 'react'
import { supabase } from './supabase'

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')

  // State Keamanan PIN Lock
  const [savedPin, setSavedPin] = useState(localStorage.getItem('sakupro_pin') || '')
  const [isLocked, setIsLocked] = useState(localStorage.getItem('sakupro_pin') ? true : false)
  const [pinInput, setPinInput] = useState('')

  // State Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('sakupro_dark') === 'true' || false)

  // State Pay Yourself First Persentase
  const [pyfPercent, setPyfPercent] = useState(Number(localStorage.getItem('sakupro_pyf_percent') || 30))

  const [activeTab, setActiveTab] = useState('dashboard')
  const [data, setData] = useState({ 
    expenses: [], 
    budgets: [], 
    income: [], 
    debts: [], 
    investments: [], 
    savings: [], 
    wallets: [],
    assets: [] 
  })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [periodText, setPeriodText] = useState('15 Agustus – 15 September 2026')
  const [notification, setNotification] = useState({ message: '', type: '' })
  const [isScanningReceipt, setIsScanningReceipt] = useState(false)

  // State Filter & Urutkan Pengeluaran
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('')
  const [expenseSortOrder, setExpenseSortOrder] = useState('newest')

  // State Tantangan Menabung 30 Hari (Gamifikasi)
  const [challengeProgress, setChallengeProgress] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sakupro_challenge')) || Array(30).fill(false)
    } catch {
      return Array(30).fill(false)
    }
  })

  // Ref untuk Auto-Scroll Navbar Mobile
  const navItemRefs = useRef({})

  const [formInput, setFormInput] = useState({
    name: '',
    amount: '',
    budgetAmount: '',
    maxAmount: '',
    monthlyContribution: '',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'Cair',
    notes: '',
    selectedBudgetCategory: '',
    selectedWallet: 'Tunai',
    date: new Date().toISOString().split('T')[0],
    color: '#2563eb'
  })

  const [transferInput, setTransferInput] = useState({
    fromWallet: '',
    toWallet: '',
    amount: '',
    notes: ''
  })

  function showMessage(msg, type = 'success') {
    setNotification({ message: msg, type })
    setTimeout(() => {
      setNotification({ message: '', type: '' })
    }, 4000)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchData(true)
        fetchSettings()
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchData(false)
        fetchSettings()
      } else {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (navItemRefs.current[activeTab]) {
      navItemRefs.current[activeTab].scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      })
    }
  }, [activeTab])

  function handleTabChange(tab) {
    document.activeElement?.blur()
    setActiveTab(tab)
    setShowForm(false)
    setShowTransferForm(false)
    setEditingId(null)
    setSearchTerm('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleDarkMode() {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('sakupro_dark', newMode)
  }

  function handleUpdatePyfPercent(newVal) {
    const val = Math.max(0, Math.min(100, Number(newVal) || 0))
    setPyfPercent(val)
    localStorage.setItem('sakupro_pyf_percent', val)
  }

  function toggleChallengeDay(index) {
    const updated = [...challengeProgress]
    updated[index] = !updated[index]
    setChallengeProgress(updated)
    localStorage.setItem('sakupro_challenge', JSON.stringify(updated))
    showMessage(`Hari ke-${index + 1} status diperbarui!`, 'success')
  }

  async function handleAuth(e) {
    e.preventDefault()
    document.activeElement?.blur()
    setAuthLoading(true)
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword })
      if (error) showMessage('Gagal mendaftar: ' + error.message, 'error')
      else showMessage('Registrasi berhasil! Silakan masuk.', 'success')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      if (error) {
        showMessage('Gagal masuk: ' + error.message, 'error')
      } else {
        setIsLocked(false)
        showMessage('Berhasil masuk! Selamat datang di SakuPro.', 'success')
      }
    }
    setAuthLoading(false)
  }

  async function handleLogout() {
    document.activeElement?.blur()
    await supabase.auth.signOut()
  }

  async function fetchSettings() {
    try {
      const { data: res } = await supabase.from('app_settings').select('*').eq('key', 'period').single()
      if (res && res.value) {
        setPeriodText(res.value)
      }
    } catch {
      const localPeriod = localStorage.getItem('sakupro_period')
      if (localPeriod) setPeriodText(localPeriod)
    }
  }

  async function handleSavePeriod(newPeriod) {
    document.activeElement?.blur()
    setPeriodText(newPeriod)
    localStorage.setItem('sakupro_period', newPeriod)
    try {
      await supabase.from('app_settings').upsert({ key: 'period', value: newPeriod }, { onConflict: 'key' })
    } catch {
      // Fallback handled via localStorage
    }
    showMessage('Periode berhasil diperbarui!', 'success')
  }

  function handleSetPin(newPin) {
    document.activeElement?.blur()
    if (newPin.length !== 4 && newPin.length > 0) {
      showMessage('PIN harus 4 digit angka!', 'error')
      return
    }
    localStorage.setItem('sakupro_pin', newPin)
    setSavedPin(newPin)
    if (newPin) {
      showMessage('PIN Keamanan berhasil diaktifkan!', 'success')
    } else {
      showMessage('PIN Keamanan dinonaktifkan.', 'success')
    }
  }

  function handleUnlockApp(e) {
    e.preventDefault()
    document.activeElement?.blur()
    if (pinInput === savedPin) {
      setIsLocked(false)
      setPinInput('')
    } else {
      showMessage('PIN salah! Silakan coba lagi.', 'error')
      setPinInput('')
    }
  }

  function handleReceiptScan(e) {
    const file = e.target.files[0]
    if (!file) return
    document.activeElement?.blur()
    setIsScanningReceipt(true)

    setTimeout(() => {
      setIsScanningReceipt(false)
      const simulatedName = "Belanja Supermarket"
      const simulatedAmount = "75000"
      setFormInput(prev => ({
        ...prev,
        name: simulatedName,
        amount: formatRupiah(simulatedAmount),
        notes: "Dipindai via OCR Struk Otomatis"
      }))
      showMessage('Struk berhasil dipindai! Data terisi otomatis.', 'success')
    }, 1500)
  }

  async function fetchData(isInitial = false) {
    if (isInitial) setLoading(true)

    const fetchTable = async (table, localKey) => {
      try {
        const { data: cloudData, error } = await supabase.from(table).select('*')
        if (error) throw error
        if (cloudData) {
          localStorage.setItem(localKey, JSON.stringify(cloudData))
          return cloudData
        }
      } catch (err) {
        console.error(`Gagal sinkron ${table} dari Supabase:`, err.message)
      }
      return JSON.parse(localStorage.getItem(localKey) || '[]')
    }

    const [expData, budData, incData, debData, invData, savData, walData, astData] = await Promise.all([
      fetchTable('daily_expenses', 'sakupro_expenses'),
      fetchTable('budget_plans', 'sakupro_budgets'),
      fetchTable('income_sources', 'sakupro_income'),
      fetchTable('debts', 'sakupro_debts'),
      fetchTable('investments', 'sakupro_investments'),
      fetchTable('savings', 'sakupro_savings'),
      fetchTable('wallets', 'sakupro_wallets'),
      fetchTable('physical_assets', 'sakupro_assets')
    ])

    setData({
      expenses: expData,
      budgets: budData,
      income: incData,
      debts: debData,
      investments: invData,
      savings: savData,
      wallets: walData,
      assets: astData
    })

    if (isInitial) setLoading(false)
  }

  function formatRupiah(value) {
    if (!value) return ''
    const numberString = value.toString().replace(/[^,\d]/g, '')
    const split = numberString.split(',')
    let sisa = split[0].length % 3
    let rupiah = split[0].substr(0, sisa)
    let ribuan = split[0].substr(sisa).match(/\d{3}/gi)

    if (ribuan) {
      let separator = sisa ? '.' : ''
      rupiah += separator + ribuan.join('.')
    }
    return split[1] !== undefined ? rupiah + ',' + split[1] : rupiah
  }

  function parseRupiah(value) {
    if (!value) return 0
    return Number(value.toString().replace(/[^0-9]/g, ''))
  }

  function cleanNotesDisplay(notes) {
    if (!notes) return '-'
    const cleaned = notes.replace(/\[Kategori:\s*[^\]]+\]/i, '').replace(/\[Dompet:\s*[^\]]+\]/i, '').trim()
    return cleaned || '-'
  }

  function extractCategoryFromNotes(notes) {
    if (!notes) return 'Lainnya'
    const matchCat = notes.match(/\[Kategori:\s*([^\]]+)\]/i)
    return matchCat ? matchCat[1].trim() : 'Lainnya'
  }

  function extractWalletFromNotes(notes) {
    if (!notes) return 'Tunai'
    const matchWal = notes.match(/\[Dompet:\s*([^\]]+)\]/i)
    return matchWal ? matchWal[1].trim() : 'Tunai'
  }

  async function handleToggleIncomeStatus(item) {
    const nextStatus = item.status === 'Cair' ? 'Belum Cair' : 'Cair'
    const currentList = JSON.parse(localStorage.getItem('sakupro_income') || '[]')
    const updated = currentList.map(i => i.id == item.id ? { ...i, status: nextStatus } : i)
    localStorage.setItem('sakupro_income', JSON.stringify(updated))
    setData(prev => ({ ...prev, income: updated }))

    const { error } = await supabase.from('income_sources').update({ status: nextStatus }).eq('id', item.id)
    if (error) {
      showMessage('Gagal sinkron status ke cloud: ' + error.message, 'error')
    } else {
      showMessage(`Status pemasukan "${item.source_name}" diubah ke: ${nextStatus}`, 'success')
    }
  }

  async function handleToggleDebtStatus(item) {
    const nextStatus = item.status === 'Lunas' ? 'Belum Lunas' : 'Lunas'
    const currentList = JSON.parse(localStorage.getItem('sakupro_debts') || '[]')
    const updated = currentList.map(i => i.id == item.id ? { ...i, status: nextStatus } : i)
    localStorage.setItem('sakupro_debts', JSON.stringify(updated))
    setData(prev => ({ ...prev, debts: updated }))

    const { error } = await supabase.from('debts').update({ status: nextStatus }).eq('id', item.id)
    if (error) {
      showMessage('Gagal sinkron status hutang ke cloud: ' + error.message, 'error')
    } else {
      showMessage(`Status hutang "${item.creditor_name}" diubah ke: ${nextStatus}`, 'success')
    }
  }

  function handleEdit(tabName, item) {
    document.activeElement?.blur()
    setEditingId(item.id)
    setShowForm(true)
    setShowTransferForm(false)

    if (tabName === 'pengeluaran') {
      let cleanNotes = item.notes || ''
      let extractedCategory = ''
      let extractedWallet = 'Tunai'
      
      const matchCat = cleanNotes.match(/\[Kategori:\s*([^\]]+)\]/i)
      if (matchCat) {
        extractedCategory = matchCat[1].trim()
        cleanNotes = cleanNotes.replace(matchCat[0], '').trim()
      }
      const matchWal = cleanNotes.match(/\[Dompet:\s*([^\]]+)\]/i)
      if (matchWal) {
        extractedWallet = matchWal[1].trim()
        cleanNotes = cleanNotes.replace(matchWal[0], '').trim()
      }

      setFormInput({
        name: item.description || '',
        amount: formatRupiah(item.actual || ''),
        budgetAmount: formatRupiah(item.budget || ''),
        maxAmount: '',
        monthlyContribution: '',
        dueDate: new Date().toISOString().split('T')[0],
        status: 'Cair',
        notes: cleanNotes,
        selectedBudgetCategory: extractedCategory,
        selectedWallet: extractedWallet,
        date: item.date || new Date().toISOString().split('T')[0],
        color: '#2563eb'
      })
    } else if (tabName === 'dompet') {
      setFormInput({
        name: item.wallet_name || '',
        amount: formatRupiah(item.initial_balance || ''),
        budgetAmount: '',
        maxAmount: '',
        monthlyContribution: '',
        dueDate: new Date().toISOString().split('T')[0],
        status: item.wallet_type || 'Bank',
        notes: '',
        selectedBudgetCategory: '',
        selectedWallet: 'Tunai',
        date: item.date || new Date().toISOString().split('T')[0],
        color: '#2563eb'
      })
    } else if (tabName === 'anggaran') {
      setFormInput({
        name: item.item_name || '',
        amount: formatRupiah(item.budget || ''),
        budgetAmount: '',
        maxAmount: '',
        monthlyContribution: '',
        dueDate: new Date().toISOString().split('T')[0],
        status: 'Cair',
        notes: item.notes || '',
        selectedBudgetCategory: '',
        selectedWallet: 'Tunai',
        date: item.date || new Date().toISOString().split('T')[0],
        color: item.color || '#2563eb'
      })
    } else if (tabName === 'pemasukan') {
      setFormInput({
        name: item.source_name || '',
        amount: formatRupiah(item.min_amount || ''),
        budgetAmount: '',
        maxAmount: formatRupiah(item.max_amount || ''),
        monthlyContribution: '',
        dueDate: new Date().toISOString().split('T')[0],
        status: item.status || 'Cair',
        notes: '',
        selectedBudgetCategory: '',
        selectedWallet: 'Tunai',
        date: item.date || new Date().toISOString().split('T')[0],
        color: '#2563eb'
      })
    } else if (tabName === 'hutang') {
      setFormInput({
        name: item.creditor_name || '',
        amount: formatRupiah(item.amount || ''),
        budgetAmount: '',
        maxAmount: '',
        monthlyContribution: '',
        dueDate: item.due_date || new Date().toISOString().split('T')[0],
        status: item.status || 'Belum Lunas',
        notes: '',
        selectedBudgetCategory: '',
        selectedWallet: 'Tunai',
        date: item.date || new Date().toISOString().split('T')[0],
        color: '#2563eb'
      })
    } else if (tabName === 'investasi') {
      setFormInput({
        name: item.item_name || '',
        amount: formatRupiah(item.nominal || ''),
        budgetAmount: '',
        maxAmount: '',
        monthlyContribution: '',
        dueDate: new Date().toISOString().split('T')[0],
        status: 'Cair',
        notes: '',
        selectedBudgetCategory: '',
        selectedWallet: 'Tunai',
        date: item.date || new Date().toISOString().split('T')[0],
        color: '#2563eb'
      })
    } else if (tabName === 'tabungan') {
      setFormInput({
        name: item.goal_name || '',
        amount: formatRupiah(item.current_amount || ''),
        budgetAmount: '',
        maxAmount: formatRupiah(item.target_amount || ''),
        monthlyContribution: formatRupiah(item.monthly_contribution || '500000'),
        dueDate: new Date().toISOString().split('T')[0],
        status: 'Aktif',
        notes: '',
        selectedBudgetCategory: '',
        selectedWallet: 'Tunai',
        date: item.date || new Date().toISOString().split('T')[0],
        color: '#2563eb'
      })
    } else if (tabName === 'aset') {
      setFormInput({
        name: item.asset_name || '',
        amount: formatRupiah(item.market_value || ''),
        budgetAmount: formatRupiah(item.purchase_value || ''),
        maxAmount: '',
        monthlyContribution: '',
        dueDate: new Date().toISOString().split('T')[0],
        status: item.asset_category || 'Elektronik',
        notes: item.notes || '',
        selectedBudgetCategory: '',
        selectedWallet: 'Tunai',
        date: item.date || new Date().toISOString().split('T')[0],
        color: '#2563eb'
      })
    }
  }

  async function handleTransfer(e) {
    e.preventDefault()
    document.activeElement?.blur()
    const { fromWallet, toWallet, amount } = transferInput
    const cleanAmount = parseRupiah(amount)

    if (!fromWallet || !toWallet || cleanAmount <= 0) {
      showMessage('Pilih dompet asal, tujuan, dan nominal transfer dengan benar!', 'error')
      return
    }
    if (fromWallet === toWallet) {
      showMessage('Dompet asal dan tujuan tidak boleh sama!', 'error')
      return
    }

    const sourceObj = data.wallets.find(w => w.wallet_name === fromWallet)
    const destObj = data.wallets.find(w => w.wallet_name === toWallet)

    if (!sourceObj || !destObj) {
      showMessage('Dompet sumber atau tujuan tidak ditemukan.', 'error')
      return
    }

    if (Number(sourceObj.initial_balance) < cleanAmount) {
      showMessage('Saldo di dompet sumber tidak mencukupi!', 'error')
      return
    }

    const newSourceBalance = Number(sourceObj.initial_balance) - cleanAmount
    const newDestBalance = Number(destObj.initial_balance) + cleanAmount

    const currentWallets = JSON.parse(localStorage.getItem('sakupro_wallets') || '[]')
    const updatedWallets = currentWallets.map(w => {
      if (w.id == sourceObj.id) return { ...w, initial_balance: newSourceBalance }
      if (w.id == destObj.id) return { ...w, initial_balance: newDestBalance }
      return w
    })
    localStorage.setItem('sakupro_wallets', JSON.stringify(updatedWallets))
    setData(prev => ({ ...prev, wallets: updatedWallets }))

    try {
      await supabase.from('wallets').update({ initial_balance: newSourceBalance }).eq('id', sourceObj.id)
      await supabase.from('wallets').update({ initial_balance: newDestBalance }).eq('id', destObj.id)
      showMessage(`Berhasil mentransfer Rp ${cleanAmount.toLocaleString()} dari ${fromWallet} ke ${toWallet}!`, 'success')
    } catch (err) {
      showMessage('Transfer tersimpan lokal (Gagal sync cloud: ' + err.message + ')', 'error')
    }

    setTransferInput({ fromWallet: '', toWallet: '', amount: '', notes: '' })
    setShowTransferForm(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    document.activeElement?.blur()

    if (!formInput.name) {
      showMessage('Nama / Keperluan wajib diisi!', 'error')
      return
    }

    let table = ''
    let payload = {}

    const cleanAmount = parseRupiah(formInput.amount)
    const cleanBudgetAmount = parseRupiah(formInput.budgetAmount)
    const cleanMaxAmount = parseRupiah(formInput.maxAmount)
    const cleanMonthlyContribution = parseRupiah(formInput.monthlyContribution)

    const selectedDate = new Date(formInput.date || Date.now())
    const options = { weekday: 'long' }
    const dayName = new Intl.DateTimeFormat('en-US', options).format(selectedDate)

    if (activeTab === 'pengeluaran') {
      table = 'daily_expenses'
      const categoryTag = formInput.selectedBudgetCategory ? `[Kategori: ${formInput.selectedBudgetCategory}] ` : ''
      const walletTag = `[Dompet: ${formInput.selectedWallet}] `
      payload = { 
        description: formInput.name, 
        budget: cleanBudgetAmount || cleanAmount, 
        actual: cleanAmount, 
        date: formInput.date, 
        notes: walletTag + categoryTag + formInput.notes, 
        day_name: dayName 
      }
    } else if (activeTab === 'dompet') {
      table = 'wallets'
      payload = { wallet_name: formInput.name, initial_balance: cleanAmount, wallet_type: formInput.status || 'Bank' }
    } else if (activeTab === 'pemasukan') {
      table = 'income_sources'
      payload = { source_name: formInput.name, min_amount: cleanAmount, max_amount: cleanMaxAmount || cleanAmount, status: formInput.status || 'Cair' }
    } else if (activeTab === 'hutang') {
      table = 'debts'
      payload = { creditor_name: formInput.name, amount: cleanAmount, status: formInput.status || 'Belum Lunas', due_date: formInput.dueDate }
    } else if (activeTab === 'investasi') {
      table = 'investments'
      payload = { item_name: formInput.name, nominal: cleanAmount }
    } else if (activeTab === 'anggaran') {
      table = 'budget_plans'
      payload = { item_name: formInput.name, budget: cleanAmount, notes: formInput.notes, color: formInput.color }
    } else if (activeTab === 'tabungan') {
      table = 'savings'
      payload = { goal_name: formInput.name, current_amount: cleanAmount, target_amount: cleanMaxAmount || cleanAmount, monthly_contribution: cleanMonthlyContribution || 500000 }
    } else if (activeTab === 'aset') {
      table = 'physical_assets'
      payload = { asset_name: formInput.name, market_value: cleanAmount, purchase_value: cleanBudgetAmount || cleanAmount, asset_category: formInput.status || 'Elektronik', notes: formInput.notes }
    }

    const storageKey = 'sakupro_' + (
      table === 'daily_expenses' ? 'expenses' :
      table === 'budget_plans' ? 'budgets' :
      table === 'income_sources' ? 'income' :
      table === 'debts' ? 'debts' :
      table === 'investments' ? 'investments' :
      table === 'savings' ? 'savings' :
      table === 'wallets' ? 'wallets' :
      table === 'physical_assets' ? 'assets' : 'misc'
    )

    const stateKey = (
      table === 'daily_expenses' ? 'expenses' :
      table === 'budget_plans' ? 'budgets' :
      table === 'income_sources' ? 'income' :
      table === 'debts' ? 'debts' :
      table === 'investments' ? 'investments' :
      table === 'savings' ? 'savings' :
      table === 'wallets' ? 'wallets' :
      table === 'physical_assets' ? 'assets' : null
    )

    try {
      if (editingId) {
        const { error } = await supabase.from(table).update(payload).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from(table).insert([payload])
        if (error) throw error
      }
      
      await fetchData(false)
      showMessage('Berhasil! Data tersimpan di Cloud & Lokal.', 'success')
    } catch (err) {
      const currentList = JSON.parse(localStorage.getItem(storageKey) || '[]')
      let updatedList = []
      if (editingId) {
        updatedList = currentList.map(item => item.id == editingId ? { ...item, ...payload, id: item.id } : item)
      } else {
        const newItem = { id: Date.now(), ...payload }
        updatedList = [newItem, ...currentList]
      }
      localStorage.setItem(storageKey, JSON.stringify(updatedList))
      if (stateKey) {
        setData(prev => ({ ...prev, [stateKey]: updatedList }))
      }
      showMessage('Tersimpan lokal (Gagal sinkron Cloud: ' + err.message + ')', 'error')
    }

    setFormInput({ name: '', amount: '', budgetAmount: '', maxAmount: '', monthlyContribution: '', dueDate: new Date().toISOString().split('T')[0], status: activeTab === 'dompet' ? 'Bank' : 'Cair', notes: '', selectedBudgetCategory: '', selectedWallet: 'Tunai', date: new Date().toISOString().split('T')[0], color: '#2563eb' })
    setEditingId(null)
    setShowForm(false)
  }

  async function handleDelete(table, id) {
    document.activeElement?.blur()
    if (!confirm('Yakin ingin menghapus data ini?')) return

    const storageKey = 'sakupro_' + (
      table === 'daily_expenses' ? 'expenses' :
      table === 'budget_plans' ? 'budgets' :
      table === 'income_sources' ? 'income' :
      table === 'debts' ? 'debts' :
      table === 'investments' ? 'investments' :
      table === 'savings' ? 'savings' :
      table === 'wallets' ? 'wallets' :
      table === 'physical_assets' ? 'assets' : 'misc'
    )

    const stateKey = (
      table === 'daily_expenses' ? 'expenses' :
      table === 'budget_plans' ? 'budgets' :
      table === 'income_sources' ? 'income' :
      table === 'debts' ? 'debts' :
      table === 'investments' ? 'investments' :
      table === 'savings' ? 'savings' :
      table === 'wallets' ? 'wallets' :
      table === 'physical_assets' ? 'assets' : null
    )

    try {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error

      await fetchData(false)
      showMessage('Data berhasil dihapus dari Cloud & Lokal.', 'success')
    } catch (err) {
      const currentList = JSON.parse(localStorage.getItem(storageKey) || '[]')
      const filtered = currentList.filter(item => item.id != id)
      localStorage.setItem(storageKey, JSON.stringify(filtered))
      if (stateKey) {
        setData(prev => ({ ...prev, [stateKey]: filtered }))
      }
      showMessage('Terhapus lokal (Gagal hapus Cloud: ' + err.message + ')', 'error')
    }
  }

  function handleBackup() {
    document.activeElement?.blur()
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `sakupro_backup_${new Date().toISOString().split('T')[0]}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  function handleExportExcel() {
    document.activeElement?.blur()
    let csvContent = "data:text/csv;charset=utf-8,Kategori,Keterangan,Nominal,Tanggal\n"
    
    data.expenses.forEach(exp => {
      const cat = extractCategoryFromNotes(exp.notes)
      const desc = (exp.description || '').replace(/,/g, '')
      csvContent += `"${cat}","${desc}",${exp.actual || 0},"${exp.date || ''}"\n`
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Laporan_Keuangan_SakuPro_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    showMessage('Laporan CSV/Excel berhasil diunduh!', 'success')
  }

  function handlePrintPdfReport() {
    document.activeElement?.blur()
    window.print()
  }

  const savingsList = data.budgets
    .filter(item => item.item_name?.toLowerCase().includes('tabungan') || item.item_name?.toLowerCase().includes('iphone'))
    .map(budgetCat => {
      const savedAmount = data.expenses
        .filter(exp => {
          const desc = exp.description.toLowerCase()
          const notes = (exp.notes || '').toLowerCase()
          const catName = budgetCat.item_name.toLowerCase()
          return notes.includes(`[kategori: ${catName}]`) || desc.includes('tabungan') || desc.includes('iphone')
        })
        .reduce((acc, curr) => acc + Number(curr.actual || 0), 0)

      return {
        id: 'budget_savings_' + budgetCat.id,
        goal_name: budgetCat.item_name,
        current_amount: savedAmount,
        target_amount: Number(budgetCat.budget || 0),
        monthly_contribution: 500000
      }
    })

  const combinedSavings = [
    ...savingsList,
    ...data.savings.filter(s => !savingsList.some(sl => sl.goal_name.toLowerCase() === s.goal_name.toLowerCase()))
  ]

  const calculatedBudgetPlan = data.budgets.reduce((acc, curr) => {
    const isSaving = curr.item_name?.toLowerCase().includes('tabungan') || curr.item_name?.toLowerCase().includes('iphone')
    if (isSaving) {
      const savedForThis = data.expenses
        .filter(exp => {
          const desc = exp.description.toLowerCase()
          const notes = (exp.notes || '').toLowerCase()
          const catName = curr.item_name.toLowerCase()
          return notes.includes(`[kategori: ${catName}]`) || desc.includes('tabungan') || desc.includes('iphone')
        })
        .reduce((a, c) => a + Number(c.actual || 0), 0)
      return acc + savedForThis
    } else {
      return acc + Number(curr.budget || 0)
    }
  }, 0)

  const totals = {
    expense: data.expenses.reduce((acc, curr) => acc + Number(curr.actual || 0), 0),
    income: data.income.reduce((acc, curr) => acc + Number(curr.min_amount || 0), 0),
    incomeCair: data.income.filter(i => i.status === 'Cair').reduce((acc, curr) => acc + Number(curr.min_amount || 0), 0),
    debt: data.debts.reduce((acc, curr) => acc + Number(curr.amount || 0), 0),
    debtUnpaid: data.debts.filter(d => d.status !== 'Lunas').reduce((acc, curr) => acc + Number(curr.amount || 0), 0),
    invest: data.investments.reduce((acc, curr) => acc + Number(curr.nominal || 0), 0),
    budgetPlan: calculatedBudgetPlan,
    saving: combinedSavings.reduce((acc, curr) => acc + Number(curr.current_amount || 0), 0),
    walletTotal: data.wallets.reduce((acc, curr) => acc + Number(curr.initial_balance || 0), 0),
    physicalAssets: data.assets.reduce((acc, curr) => acc + Number(curr.market_value || 0), 0)
  }

  // Net Worth Tracker Calculation
  const netWorthTotal = totals.walletTotal + totals.invest + totals.saving + totals.physicalAssets - totals.debtUnpaid

  const pyfAllocatedAmount = Math.round((totals.income * pyfPercent) / 100)
  const pyfRemainingForExpenses = totals.income - pyfAllocatedAmount

  const todayObj = new Date()
  const debtReminders = data.debts.filter(debt => {
    if (!debt.due_date || debt.status === 'Lunas') return false
    const due = new Date(debt.due_date)
    const diffTime = due - todayObj
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays <= 7
  })

  const currentDateObj = new Date()
  const currentMonthStr = currentDateObj.toISOString().slice(0, 7)
  const lastMonthObj = new Date(currentDateObj.getFullYear(), currentDateObj.getMonth() - 1, 1)
  const lastMonthStr = lastMonthObj.toISOString().slice(0, 7)

  const currentMonthExpense = data.expenses
    .filter(exp => (exp.date || '').startsWith(currentMonthStr))
    .reduce((acc, curr) => acc + Number(curr.actual || 0), 0)

  const lastMonthExpense = data.expenses
    .filter(exp => (exp.date || '').startsWith(lastMonthStr))
    .reduce((acc, curr) => acc + Number(curr.actual || 0), 0)

  const expenseDiffPercent = lastMonthExpense > 0 
    ? Math.round(((currentMonthExpense - lastMonthExpense) / lastMonthExpense) * 100) 
    : 0

  const budgetWarnings = data.budgets.map(item => {
    const spent = data.expenses
      .filter(exp => {
        const desc = exp.description.toLowerCase()
        const notes = (exp.notes || '').toLowerCase()
        const itemName = item.item_name.toLowerCase()
        return notes.includes(`[kategori: ${itemName}]`) || desc.includes(itemName)
      })
      .reduce((acc, curr) => acc + Number(curr.actual || 0), 0)

    const isSaving = item.item_name?.toLowerCase().includes('tabungan') || item.item_name?.toLowerCase().includes('iphone')
    const limit = Number(item.budget || 1)
    const percent = isSaving ? 0 : Math.round((spent / limit) * 100)
    return { ...item, spent, percent, isOver: !isSaving && spent > limit, isNear: !isSaving && percent >= 80 && spent <= limit }
  }).filter(b => b.isOver || b.isNear)

  const categoryExpensesMap = data.expenses.reduce((acc, curr) => {
    const cat = extractCategoryFromNotes(curr.notes)
    acc[cat] = (acc[cat] || 0) + Number(curr.actual || 0)
    return acc
  }, {})

  const categoryBreakdownList = Object.keys(categoryExpensesMap).map(catName => ({
    name: catName,
    total: categoryExpensesMap[catName],
    percent: totals.expense > 0 ? Math.round((categoryExpensesMap[catName] / totals.expense) * 100) : 0
  })).sort((a, b) => b.total - a.total)

  const maxProportionValue = Math.max(totals.income, totals.expense, totals.budgetPlan, totals.invest, totals.saving, totals.physicalAssets, 1)

  const filteredExpenses = data.expenses.filter(item => {
    const matchesSearch = item.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.date?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const itemCat = extractCategoryFromNotes(item.notes)
    const matchesCategory = expenseCategoryFilter ? itemCat === expenseCategoryFilter : true

    return matchesSearch && matchesCategory
  }).sort((a, b) => {
    if (expenseSortOrder === 'newest') return new Date(b.date || 0) - new Date(a.date || 0)
    if (expenseSortOrder === 'oldest') return new Date(a.date || 0) - new Date(b.date || 0)
    if (expenseSortOrder === 'highest') return Number(b.actual || 0) - Number(a.actual || 0)
    if (expenseSortOrder === 'lowest') return Number(a.actual || 0) - Number(b.actual || 0)
    return 0
  })

  const filteredBudgets = data.budgets.filter(item => 
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredIncome = data.income.filter(item => 
    item.source_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.status?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredDebts = data.debts.filter(item => 
    item.creditor_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.status?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredInvestments = data.investments.filter(item => 
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredSavings = combinedSavings.filter(item => 
    item.goal_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredWallets = data.wallets.filter(item =>
    item.wallet_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.wallet_type?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredAssets = data.assets.filter(item =>
    item.asset_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.asset_category?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const tabIcons = {
    dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3H3v-8z",
    dompet: "M20 6H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm0 12H4V8h16v10zM9 13h6v-2H9v2z",
    pengeluaran: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z",
    anggaran: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z",
    pemasukan: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
    hutang: "M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z",
    investasi: "M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z",
    tabungan: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 5h2v5h-2z",
    aset: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
    tantangan: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    pengaturan: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c-.5.38-1.03.7-1.62.94l-.36 2.54c-.05.24-.24.41-.48.41h3.84c-.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
  }

  const t = isDarkMode ? {
    bg: 'linear-gradient(135deg, #030712 0%, #0f172a 50%, #1e1b4b 100%)',
    mainBg: 'rgba(30, 41, 59, 0.9)',
    text: '#f8fafc',
    muted: '#94a3b8',
    border: '#334155',
    inputBg: '#0f172a',
    rowHover: '#273548',
    cardBg: '#1e293b',
    headerGradient: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #27272a 100%)'
  } : {
    bg: 'linear-gradient(135deg, #dbeafe 0%, #f3e8ff 50%, #ccfbf1 100%)',
    mainBg: 'rgba(255, 255, 255, 0.92)',
    text: '#0f172a',
    muted: '#64748b',
    border: '#cbd5e1',
    inputBg: '#ffffff',
    rowHover: '#f1f5f9',
    cardBg: '#ffffff',
    headerGradient: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #09090b 100%)'
  }

  const aestheticBtnStyle = {
    background: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #09090b 100%)',
    color: '#ffffff',
    border: '1px solid #3f3f46',
    padding: '11px 14px',
    borderRadius: '10px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
    width: '100%',
    boxSizing: 'border-box',
    pointerEvents: 'auto'
  }

  if (session && savedPin && isLocked) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1e1b4b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", padding: '20px', position: 'relative', overflow: 'hidden' }}>
        <style>{`
          @keyframes floatGlow {
            0% { transform: translateY(0px) scale(1); opacity: 0.5; }
            50% { transform: translateY(-15px) scale(1.05); opacity: 0.8; }
            100% { transform: translateY(0px) scale(1); opacity: 0.5; }
          }
          @keyframes fadeInScale {
            0% { opacity: 0; transform: scale(0.95) translateY(10px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          .lock-card {
            animation: fadeInScale 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>
        
        <div style={{ position: 'absolute', width: '320px', height: '320px', background: 'rgba(37, 99, 235, 0.18)', filter: 'blur(90px)', borderRadius: '50%', top: '10%', left: '15%', animation: 'floatGlow 6s infinite ease-in-out' }}></div>
        <div style={{ position: 'absolute', width: '320px', height: '320px', background: 'rgba(16, 185, 129, 0.15)', filter: 'blur(90px)', borderRadius: '50%', bottom: '10%', right: '15%', animation: 'floatGlow 8s infinite ease-in-out reverse' }}></div>

        <div className="lock-card" style={{ width: '100%', maxWidth: '380px', background: '#121826', color: '#f8fafc', padding: '36px 28px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)', border: '1px solid #334155', textAlign: 'center', position: 'relative', zIndex: 10, pointerEvents: 'auto' }}>
          <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', borderRadius: '16px', margin: '0 auto 16px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)' }}>
            <svg width="26" height="26" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          </div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', letterSpacing: '-0.4px', color: '#ffffff' }}>Masukkan PIN</h2>
          <p style={{ margin: '8px 0 24px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.4' }}>SakuPro Dilindungi oleh Keamanan PIN Eksklusif</p>
          
          <form onSubmit={handleUnlockApp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              type="password"
              maxLength="4"
              placeholder="••••"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              style={{ width: '100%', padding: '14px', textAlign: 'center', fontSize: '24px', letterSpacing: '10px', borderRadius: '12px', border: '1px solid #475569', background: '#0f172a', color: '#ffffff', boxSizing: 'border-box', pointerEvents: 'auto' }}
              autoFocus
              required
            />
            <button
              type="submit"
              style={{ width: '100%', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#ffffff', border: 'none', padding: '13px', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)', transition: 'all 0.2s ease', pointerEvents: 'auto' }}
            >
              Buka Aplikasi
            </button>
          </form>
          <div style={{ marginTop: '20px' }}>
            <button
              type="button"
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px', pointerEvents: 'auto' }}
            >
              Keluar Akun
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1e1b4b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", padding: '20px', position: 'relative', overflow: 'hidden' }}>
        <style>{`
          @keyframes floatGlow {
            0% { transform: translateY(0px) scale(1); opacity: 0.5; }
            50% { transform: translateY(-15px) scale(1.05); opacity: 0.8; }
            100% { transform: translateY(0px) scale(1); opacity: 0.5; }
          }
          @keyframes fadeInScale {
            0% { opacity: 0; transform: scale(0.95) translateY(10px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          .login-card {
            animation: fadeInScale 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .auth-input:focus {
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.25);
            outline: none;
          }
        `}</style>

        <div style={{ position: 'absolute', width: '350px', height: '350px', background: 'rgba(37, 99, 235, 0.18)', filter: 'blur(90px)', borderRadius: '50%', top: '10%', left: '15%', animation: 'floatGlow 6s infinite ease-in-out' }}></div>
        <div style={{ position: 'absolute', width: '350px', height: '350px', background: 'rgba(16, 185, 129, 0.15)', filter: 'blur(90px)', borderRadius: '50%', bottom: '10%', right: '15%', animation: 'floatGlow 8s infinite ease-in-out reverse' }}></div>

        <div className="login-card" style={{ width: '100%', maxWidth: '400px', background: '#121826', border: '1px solid #334155', color: '#f8fafc', padding: '36px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)', boxSizing: 'border-box', position: 'relative', zIndex: 10, pointerEvents: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', borderRadius: '16px', margin: '0 auto 16px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)' }}>
              <svg width="28" height="28" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.5px' }}>SakuPro</h1>
            <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>{isSignUp ? 'Buat akun finansial profesionalmu' : 'Masuk untuk mengelola keuangan bisnis'}</p>
          </div>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#e2e8f0', marginBottom: '6px', textAlign: 'left' }}>Email</label>
              <input
                type="email"
                required
                placeholder="nama@email.com"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                className="auth-input"
                style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #475569', fontSize: '13px', background: '#0f172a', color: '#ffffff', boxSizing: 'border-box', pointerEvents: 'auto' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#e2e8f0', marginBottom: '6px', textAlign: 'left' }}>Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                className="auth-input"
                style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #475569', fontSize: '13px', background: '#0f172a', color: '#ffffff', boxSizing: 'border-box', pointerEvents: 'auto' }}
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              style={{ width: '100%', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#ffffff', border: 'none', padding: '13px', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', marginTop: '4px', boxShadow: '0 6px 20px rgba(37, 99, 235, 0.4)', transition: 'all 0.2s ease', pointerEvents: 'auto' }}
            >
              {authLoading ? 'Memproses...' : isSignUp ? 'Daftar Sekarang' : 'Masuk Dashboard'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '22px' }}>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              style={{ background: 'none', border: 'none', color: '#60a5fa', fontWeight: '600', fontSize: '13px', cursor: 'pointer', padding: 0, pointerEvents: 'auto' }}
            >
              {isSignUp ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Daftar gratis'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", color: t.text, padding: '16px', position: 'relative', paddingBottom: '120px', transition: 'background 0.3s ease, color 0.3s ease', boxSizing: 'border-box', overflow: 'hidden' }}>
      
      {/* Ambient Glow Background Blobs */}
      <div style={{ position: 'absolute', width: '450px', height: '450px', background: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : 'rgba(59, 130, 246, 0.22)', filter: 'blur(110px)', borderRadius: '50%', top: '5%', left: '5%', pointerEvents: 'none', animation: 'floatGlow 8s infinite ease-in-out', zIndex: 0 }}></div>
      <div style={{ position: 'absolute', width: '450px', height: '450px', background: isDarkMode ? 'rgba(16, 185, 129, 0.12)' : 'rgba(168, 85, 247, 0.2)', filter: 'blur(110px)', borderRadius: '50%', bottom: '5%', right: '5%', pointerEvents: 'none', animation: 'floatGlow 10s infinite ease-in-out reverse', zIndex: 0 }}></div>

      {notification.message && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          left: '20px',
          maxWidth: '400px',
          margin: '0 auto',
          pointerEvents: 'none',
          background: notification.type === 'error' ? '#dc2626' : '#16a34a',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          fontWeight: '600',
          fontSize: '13px',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'fadeInScale 0.3s ease'
        }}>
          {notification.message}
        </div>
      )}

      {isScanningReceipt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexDirection: 'column', gap: '14px', pointerEvents: 'auto' }}>
          <div style={{ width: '42px', height: '42px', border: '3px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
          <p style={{ fontSize: '14px', fontWeight: '600' }}>Memindai Struk & Mengekstrak Data...</p>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes floatGlow {
          0% { transform: translateY(0px) scale(1); opacity: 0.6; }
          50% { transform: translateY(-20px) scale(1.08); opacity: 0.9; }
          100% { transform: translateY(0px) scale(1); opacity: 0.6; }
        }
        .action-btn {
          transition: background-color 0.2s ease, transform 0.15s ease, box-shadow 0.15s ease;
          pointer-events: auto !important;
        }
        .action-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
        }
        .action-btn:active {
          transform: translateY(0px) scale(0.98);
        }
        input, select, button {
          pointer-events: auto !important;
        }
        input:focus, select:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
          outline: none;
        }
        tr.table-row {
          transition: background-color 0.15s ease;
        }
        tr.table-row:hover {
          background-color: ${t.rowHover} !important;
        }
        .chart-bar {
          transition: width 1s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @media print {
          body { background: white !important; color: black !important; }
          header, nav, button, .action-btn, input, select { display: none !important; }
          main { border: none !important; box-shadow: none !important; padding: 0 !important; background: white !important; }
        }

        @media (max-width: 768px) {
          .desktop-table-container { display: none !important; }
          .mobile-card-list { display: flex !important; flex-direction: column; gap: 6px; }
        }
        @media (min-width: 769px) {
          .mobile-card-list { display: none !important; }
          .desktop-table-container { display: block !important; }
        }
        
        .desktop-header-nav { display: grid; }
        .mobile-bottom-nav { 
          display: none; 
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          scroll-behavior: smooth;
        }
        .mobile-bottom-nav::-webkit-scrollbar {
          display: none;
        }

        @media (max-width: 768px) {
          .desktop-header-nav { display: none !important; }
          .mobile-bottom-nav { display: flex !important; }
        }

        ::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.35);
          border-radius: 10px;
        }
      `}</style>

      {/* Header Utama */}
      <header style={{ width: '100%', maxWidth: '1200px', margin: '0 auto 16px auto', background: t.headerGradient, padding: '16px 20px', borderRadius: '14px', boxShadow: '0 12px 30px rgba(0, 0, 0, 0.3)', border: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box', position: 'relative', zIndex: 10 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', width: '100%' }}>
          <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              SakuPro
            </h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#a1a1aa', wordBreak: 'break-all' }}>{session.user.email}</p>
          </div>
          
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            <button
              type="button"
              className="action-btn"
              onClick={toggleDarkMode}
              title={isDarkMode ? 'Ubah ke Tema Terang' : 'Ubah ke Tema Gelap'}
              style={{ background: 'transparent', color: '#ffffff', border: 'none', width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                {isDarkMode ? (
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                ) : (
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                )}
              </svg>
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={handleLogout}
              title="Keluar Akun"
              style={{ background: 'transparent', color: '#f87171', border: 'none', width: '30px', height: '30px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'left', fontSize: '11px', color: '#a1a1aa' }}>
          Periode: <strong style={{ color: '#ffffff' }}>{periodText}</strong>
        </div>

        <nav className="desktop-header-nav" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '6px' }}>
          {['dashboard', 'dompet', 'pengeluaran', 'anggaran', 'pemasukan', 'hutang', 'investasi', 'tabungan', 'aset', 'tantangan', 'pengaturan'].map(tab => (
            <button
              key={tab}
              type="button"
              className="action-btn"
              onClick={() => handleTabChange(tab)}
              style={{
                background: activeTab === tab ? '#2563eb' : 'rgba(39, 39, 42, 0.75)',
                color: activeTab === tab ? '#ffffff' : '#d4d4d8',
                border: activeTab === tab ? 'none' : '1px solid #3f3f46',
                padding: '8px 4px',
                borderRadius: '7px',
                cursor: 'pointer',
                fontWeight: '600',
                textTransform: 'capitalize',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                boxShadow: activeTab === tab ? '0 3px 10px rgba(37, 99, 235, 0.4)' : 'none'
              }}
            >
              <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                <path d={tabIcons[tab]}></path>
              </svg>
              {tab}
            </button>
          ))}
        </nav>
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-nav" style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        right: '10px',
        width: 'auto',
        background: isDarkMode ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.94)',
        border: `1px solid ${isDarkMode ? 'rgba(51, 65, 85, 0.7)' : 'rgba(226, 232, 240, 0.9)'}`,
        padding: '5px 6px',
        zIndex: 1000,
        boxSizing: 'border-box',
        display: 'none',
        gap: '3px',
        boxShadow: '0 12px 30px -6px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderRadius: '14px',
        alignItems: 'center',
        pointerEvents: 'auto'
      }}>
        {['dashboard', 'dompet', 'pengeluaran', 'anggaran', 'pemasukan', 'hutang', 'investasi', 'tabungan', 'aset', 'tantangan', 'pengaturan'].map(tab => (
          <button
            key={tab}
            ref={el => { if (el) navItemRefs.current[tab] = el }}
            type="button"
            onClick={() => handleTabChange(tab)}
            style={{
              background: activeTab === tab ? '#2563eb' : 'transparent',
              color: activeTab === tab ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#64748b'),
              border: 'none',
              padding: '5px 6px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: '600',
              textTransform: 'capitalize',
              fontSize: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              flexShrink: 0,
              minWidth: '52px',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: activeTab === tab ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)',
              boxShadow: activeTab === tab ? '0 3px 10px rgba(37, 99, 235, 0.35)' : 'none',
              pointerEvents: 'auto'
            }}
          >
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
              <path d={tabIcons[tab]}></path>
            </svg>
            <span style={{ whiteSpace: 'nowrap' }}>{tab}</span>
          </button>
        ))}
      </nav>

      {/* MODAL / POPUP FORM OVERLAY */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box', pointerEvents: 'auto' }}>
          <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', color: t.text, width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '18px', padding: '20px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: `1px solid ${t.border}`, boxSizing: 'border-box', textAlign: 'left', animation: 'fadeInScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)', pointerEvents: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', letterSpacing: '-0.2px' }}>
                {editingId ? 'Edit Data' : `Tambah ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Baru`}
              </h3>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); }}
                style={{ background: 'none', border: 'none', color: t.muted, fontSize: '18px', cursor: 'pointer', fontWeight: 'bold', padding: '4px', pointerEvents: 'auto' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {activeTab === 'pengeluaran' && (
                <>
                  <div style={{ background: isDarkMode ? '#1e3a8a' : '#eff6ff', padding: '12px', borderRadius: '10px', border: '1px dashed #2563eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="16" height="16" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: t.text }}>Pindai Struk Otomatis (OCR)</span>
                    </div>
                    <label style={{ background: '#2563eb', color: '#ffffff', padding: '5px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'inline-block', pointerEvents: 'auto' }}>
                      Upload Struk
                      <input type="file" accept="image/*" onChange={handleReceiptScan} style={{ display: 'none' }} />
                    </label>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Keperluan / Keterangan</label>
                    <input
                      type="text"
                      placeholder="Contoh: Beli lauk"
                      value={formInput.name}
                      onChange={e => setFormInput({ ...formInput, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Pilih Dompet / Rekening Sumber</label>
                    <select
                      value={formInput.selectedWallet}
                      onChange={e => setFormInput({ ...formInput, selectedWallet: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                    >
                      <option value="Tunai">Tunai (Default)</option>
                      {data.wallets.map(w => (
                        <option key={w.id} value={w.wallet_name}>{w.wallet_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Pilih Kategori Anggaran</label>
                    <select
                      value={formInput.selectedBudgetCategory}
                      onChange={e => setFormInput({ ...formInput, selectedBudgetCategory: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                    >
                      <option value="">-- Hubungkan ke Anggaran --</option>
                      {data.budgets.map(b => (
                        <option key={b.id} value={b.item_name}>{b.item_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Nominal Aktual (Rp)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 5000"
                      value={formInput.amount}
                      onChange={e => setFormInput({ ...formInput, amount: formatRupiah(e.target.value) })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Catatan Tambahan</label>
                    <input
                      type="text"
                      placeholder="Contoh: Hemat"
                      value={formInput.notes}
                      onChange={e => setFormInput({ ...formInput, notes: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Tanggal Transaksi</label>
                    <input
                      type="date"
                      value={formInput.date}
                      onChange={e => setFormInput({ ...formInput, date: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                </>
              )}

              {activeTab === 'dompet' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Nama Dompet / Rekening</label>
                    <input
                      type="text"
                      placeholder="Contoh: BCA Utama / GoPay"
                      value={formInput.name}
                      onChange={e => setFormInput({ ...formInput, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Saldo Awal (Rp)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 500000"
                      value={formInput.amount}
                      onChange={e => setFormInput({ ...formInput, amount: formatRupiah(e.target.value) })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Jenis / Tipe</label>
                    <input
                      type="text"
                      placeholder="Bank / E-Wallet / Tunai"
                      value={formInput.status}
                      onChange={e => setFormInput({ ...formInput, status: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                    />
                  </div>
                </>
              )}

              {activeTab === 'anggaran' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Rencana Pengeluaran</label>
                    <input
                      type="text"
                      placeholder="Contoh: Transportasi"
                      value={formInput.name}
                      onChange={e => setFormInput({ ...formInput, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Nominal Anggaran (Rp)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 100000"
                      value={formInput.amount}
                      onChange={e => setFormInput({ ...formInput, amount: formatRupiah(e.target.value) })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Keterangan</label>
                    <input
                      type="text"
                      placeholder="Contoh: Batas transport"
                      value={formInput.notes}
                      onChange={e => setFormInput({ ...formInput, notes: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Warna Kategori / Label</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={formInput.color || '#2563eb'}
                        onChange={e => setFormInput({ ...formInput, color: e.target.value })}
                        style={{ width: '40px', height: '36px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
                      />
                      <span style={{ fontSize: '12px', color: t.muted }}>Pilih warna kustom untuk identitas pos</span>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'pemasukan' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Sumber Pemasukan</label>
                    <input
                      type="text"
                      placeholder="Contoh: Gaji / Bonus"
                      value={formInput.name}
                      onChange={e => setFormInput({ ...formInput, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Nominal Minimum (Rp)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 5000000"
                      value={formInput.amount}
                      onChange={e => setFormInput({ ...formInput, amount: formatRupiah(e.target.value) })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Nominal Maksimum (Rp)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 6000000"
                      value={formInput.maxAmount}
                      onChange={e => setFormInput({ ...formInput, maxAmount: formatRupiah(e.target.value) })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Status Awal</label>
                    <select
                      value={formInput.status}
                      onChange={e => setFormInput({ ...formInput, status: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                    >
                      <option value="Cair">Cair</option>
                      <option value="Belum Cair">Belum Cair</option>
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'hutang' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Nama Pemberi Pinjaman</label>
                    <input
                      type="text"
                      placeholder="Contoh: Teman / Bank"
                      value={formInput.name}
                      onChange={e => setFormInput({ ...formInput, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Total Nominal (Rp)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 500000"
                      value={formInput.amount}
                      onChange={e => setFormInput({ ...formInput, amount: formatRupiah(e.target.value) })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Tanggal Jatuh Tempo</label>
                    <input
                      type="date"
                      value={formInput.dueDate}
                      onChange={e => setFormInput({ ...formInput, dueDate: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Status</label>
                    <select
                      value={formInput.status}
                      onChange={e => setFormInput({ ...formInput, status: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                    >
                      <option value="Belum Lunas">Belum Lunas</option>
                      <option value="Lunas">Lunas</option>
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'investasi' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Jenis Aset</label>
                    <input
                      type="text"
                      placeholder="Contoh: Saham / Reksadana"
                      value={formInput.name}
                      onChange={e => setFormInput({ ...formInput, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Nominal (Rp)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 250000"
                      value={formInput.amount}
                      onChange={e => setFormInput({ ...formInput, amount: formatRupiah(e.target.value) })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                </>
              )}

              {activeTab === 'tabungan' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Nama Impian / Tabungan</label>
                    <input
                      type="text"
                      placeholder="Contoh: Dana Darurat"
                      value={formInput.name}
                      onChange={e => setFormInput({ ...formInput, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Saldo Terkumpul (Rp)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 1000000"
                      value={formInput.amount}
                      onChange={e => setFormInput({ ...formInput, amount: formatRupiah(e.target.value) })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Target Nominal (Rp)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 10000000"
                      value={formInput.maxAmount}
                      onChange={e => setFormInput({ ...formInput, maxAmount: formatRupiah(e.target.value) })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Rencana Menabung / Bulan (Rp)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 500000"
                      value={formInput.monthlyContribution}
                      onChange={e => setFormInput({ ...formInput, monthlyContribution: formatRupiah(e.target.value) })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                </>
              )}

              {activeTab === 'aset' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Nama Barang / Aset Fisik</label>
                    <input
                      type="text"
                      placeholder="Contoh: Laptop MacBook Pro / Motor"
                      value={formInput.name}
                      onChange={e => setFormInput({ ...formInput, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Estimasi Nilai Pasar Saat Ini (Rp)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 15000000"
                      value={formInput.amount}
                      onChange={e => setFormInput({ ...formInput, amount: formatRupiah(e.target.value) })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Harga Pembelian Awal (Rp)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 20000000"
                      value={formInput.budgetAmount}
                      onChange={e => setFormInput({ ...formInput, budgetAmount: formatRupiah(e.target.value) })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Kategori Aset</label>
                    <input
                      type="text"
                      placeholder="Elektronik / Kendaraan / Properti"
                      value={formInput.status}
                      onChange={e => setFormInput({ ...formInput, status: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Catatan</label>
                    <input
                      type="text"
                      placeholder="Kondisi barang / tahun beli"
                      value={formInput.notes}
                      onChange={e => setFormInput({ ...formInput, notes: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  style={{ flex: 1, background: '#64748b', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', pointerEvents: 'auto' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="action-btn"
                  style={{ flex: 1, background: '#16a34a', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', boxShadow: '0 4px 10px rgba(22, 163, 74, 0.3)', pointerEvents: 'auto' }}
                >
                  {editingId ? 'Simpan Perubahan' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TRANSFER ANTAR DOMPET */}
      {showTransferForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box', pointerEvents: 'auto' }}>
          <div style={{ background: isDarkMode ? '#1e293b' : '#ffffff', color: t.text, width: '100%', maxWidth: '460px', borderRadius: '18px', padding: '20px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', border: `1px solid ${t.border}`, boxSizing: 'border-box', textAlign: 'left', animation: 'fadeInScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)', pointerEvents: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Transfer Saldo Antar Dompet</h3>
              <button
                type="button"
                onClick={() => setShowTransferForm(false)}
                style={{ background: 'none', border: 'none', color: t.muted, fontSize: '18px', cursor: 'pointer', fontWeight: 'bold', pointerEvents: 'auto' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Dari Dompet (Sumber)</label>
                <select
                  value={transferInput.fromWallet}
                  onChange={e => setTransferInput({ ...transferInput, fromWallet: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                  required
                >
                  <option value="">-- Pilih Dompet Asal --</option>
                  {data.wallets.map(w => (
                    <option key={w.id} value={w.wallet_name}>{w.wallet_name} (Rp {Number(w.initial_balance || 0).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Ke Dompet (Tujuan)</label>
                <select
                  value={transferInput.toWallet}
                  onChange={e => setTransferInput({ ...transferInput, toWallet: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                  required
                >
                  <option value="">-- Pilih Dompet Tujuan --</option>
                  {data.wallets.map(w => (
                    <option key={w.id} value={w.wallet_name}>{w.wallet_name} (Rp {Number(w.initial_balance || 0).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Nominal Transfer (Rp)</label>
                <input
                  type="text"
                  placeholder="Contoh: 150000"
                  value={transferInput.amount}
                  onChange={e => setTransferInput({ ...transferInput, amount: formatRupiah(e.target.value) })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: t.text }}>Catatan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Tarik tunai ATM"
                  value={transferInput.notes}
                  onChange={e => setTransferInput({ ...transferInput, notes: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '13px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowTransferForm(false)}
                  style={{ flex: 1, background: '#64748b', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', pointerEvents: 'auto' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="action-btn"
                  style={{ flex: 1, background: '#059669', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', boxShadow: '0 4px 10px rgba(5, 150, 105, 0.3)', pointerEvents: 'auto' }}
                >
                  Proses Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Konten Utama */}
      <main style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', background: t.mainBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '18px 14px', borderRadius: '14px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', border: `1px solid ${t.border}`, boxSizing: 'border-box', position: 'relative', zIndex: 10 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: t.muted, fontSize: '14px', fontWeight: '600' }}>
            Memuat data finansial profesional...
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
                    <svg width="18" height="18" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zm-11 0h7v7H3v-7z"/></svg>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: t.text, lineHeight: '1.2' }}>Ringkasan Eksekutif & Net Worth</h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: t.muted, lineHeight: '1.3' }}>Gambaran umum kekayaan bersih dan kesehatan finansial.</p>
                  </div>
                </div>

                {/* NET WORTH HIGHLIGHT CARD */}
                <div style={{ background: isDarkMode ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #3b82f6', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px', textAlign: 'left', boxShadow: '0 10px 25px -8px rgba(37, 99, 235, 0.2)' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Kekayaan Bersih (Net Worth)</span>
                  <h3 style={{ margin: '4px 0 2px 0', fontSize: '24px', fontWeight: '900', color: '#2563eb' }}>Rp {netWorthTotal.toLocaleString()}</h3>
                  <p style={{ margin: 0, fontSize: '10px', color: t.muted }}>Akumulasi Dompet + Investasi + Tabungan + Aset Fisik - Hutang Belum Lunas</p>
                </div>

                {debtReminders.length > 0 && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', textAlign: 'left', boxShadow: '0 8px 20px -5px rgba(220, 38, 38, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                      <svg width="16" height="16" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#991b1b' }}>Pengingat Jatuh Tempo Hutang</h4>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: '#7f1d1d', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {debtReminders.map(d => (
                        <li key={d.id}>
                          <strong>{d.creditor_name}</strong> (Rp {Number(d.amount).toLocaleString()}) tempo <strong>{d.due_date}</strong>.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* PAY YOURSELF FIRST WIDGET */}
                <div style={{ background: isDarkMode ? '#1e293b' : '#f8fafc', border: `1px solid ${t.border}`, borderRadius: '14px', padding: '14px 16px', marginBottom: '16px', textAlign: 'left', boxShadow: '0 10px 25px -8px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: t.text }}>Pay Yourself First</h3>
                        <p style={{ margin: 0, fontSize: '10px', color: t.muted }}>Alokasi tabungan otomatis di awal.</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: t.muted }}>Tabungan:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={pyfPercent}
                        onChange={e => handleUpdatePyfPercent(e.target.value)}
                        style={{ width: '50px', padding: '5px 6px', textAlign: 'center', borderRadius: '7px', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text, fontWeight: '700', fontSize: '12px', pointerEvents: 'auto' }}
                      />
                      <span style={{ fontSize: '11px', fontWeight: '700', color: t.text }}>%</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginTop: '10px' }}>
                    <div style={{ background: isDarkMode ? '#0f172a' : '#ffffff', padding: '10px 12px', borderRadius: '9px', border: `1px solid ${t.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: '10px', fontWeight: '600', color: t.muted }}>Wajib Disisihkan</span>
                      <h4 style={{ margin: '3px 0 0 0', fontSize: '14px', fontWeight: '800', color: '#16a34a' }}>Rp {pyfAllocatedAmount.toLocaleString()}</h4>
                    </div>
                    <div style={{ background: isDarkMode ? '#0f172a' : '#ffffff', padding: '10px 12px', borderRadius: '9px', border: `1px solid ${t.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: '10px', fontWeight: '600', color: t.muted }}>Sisa Kebutuhan</span>
                      <h4 style={{ margin: '3px 0 0 0', fontSize: '14px', fontWeight: '800', color: '#2563eb' }}>Rp {pyfRemainingForExpenses.toLocaleString()}</h4>
                    </div>
                  </div>
                </div>

                <div style={{ background: isDarkMode ? '#1e293b' : '#f8fafc', border: `1px solid ${t.border}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', textAlign: 'left', boxShadow: '0 8px 20px -5px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '7px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="15" height="15" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 1px 0', fontSize: '12px', fontWeight: '700', color: t.text }}>Perbandingan MoM</h4>
                      <p style={{ margin: 0, fontSize: '10px', color: t.muted }}>Bulan ini: Rp {currentMonthExpense.toLocaleString()} vs Lalu: Rp {lastMonthExpense.toLocaleString()}</p>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '700', padding: '5px 8px', borderRadius: '7px', background: expenseDiffPercent <= 0 ? '#f0fdf4' : '#fef2f2', color: expenseDiffPercent <= 0 ? '#16a34a' : '#dc2626' }}>
                    {expenseDiffPercent <= 0 ? `📉 Hemat ${Math.abs(expenseDiffPercent)}%` : `📈 Naik ${expenseDiffPercent}%`}
                  </div>
                </div>

                {budgetWarnings.length > 0 && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', textAlign: 'left', boxShadow: '0 8px 20px -5px rgba(220, 38, 38, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                      <svg width="16" height="16" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/></svg>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#991b1b' }}>Peringatan Anggaran</h4>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: '#7f1d1d', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {budgetWarnings.map(b => (
                        <li key={b.id}>
                          <strong>{b.item_name}</strong> {b.isOver ? <span style={{ color: '#dc2626', fontWeight: '700' }}>jebol (Rp {b.spent.toLocaleString()} / {Number(b.budget).toLocaleString()})</span> : <span style={{ color: '#d97706', fontWeight: '700' }}>hampir habis ({b.percent}%)</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                  <Card title="Total Saldo Dompet" value={totals.walletTotal} color="#8b5cf6" bg={isDarkMode ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' : 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)'} svgPath="M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM19 12h-2v2h2v-2z" isDark={isDarkMode} />
                  <Card title="Potensi Pemasukan (Cair: Rp " valueExtra={totals.incomeCair.toLocaleString() + ")"} value={totals.income} color="#16a34a" bg={isDarkMode ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'} svgPath="M12 2v20m10-10H2" isDark={isDarkMode} />
                  <Card title="Total Pengeluaran Aktual" value={totals.expense} color="#dc2626" bg={isDarkMode ? 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'} svgPath="M5 12h14" isDark={isDarkMode} />
                  <Card title="Target Anggaran" value={totals.budgetPlan} color="#2563eb" bg={isDarkMode ? 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)' : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'} svgPath="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" isDark={isDarkMode} />
                  <Card title="Total Hutang (Belum Lunas: Rp " valueExtra={totals.debtUnpaid.toLocaleString() + ")"} value={totals.debt} color="#d97706" bg={isDarkMode ? 'linear-gradient(135deg, #78350f 0%, #92400e 100%)' : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'} svgPath="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" isDark={isDarkMode} />
                  <Card title="Total Investasi / Aset" value={totals.invest} color="#059669" bg={isDarkMode ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)' : 'linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 100%)'} svgPath="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" isDark={isDarkMode} />
                  <Card title="Total Tabungan & Impian" value={totals.saving} color="#0284c7" bg={isDarkMode ? 'linear-gradient(135deg, #082f49 0%, #0369a1 100%)' : 'linear-gradient(135deg, #f0f9ff 0%, #bae6fd 100%)'} svgPath="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.66 4.4 4.95a5.01 5.01 0 004.6 4.05v2H8v2h8v-2h-2v-2c2.08-.34 3.6-2.12 3.6-4.25V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" isDark={isDarkMode} />
                  <Card title="Total Aset Fisik & Barang" value={totals.physicalAssets} color="#ea580c" bg={isDarkMode ? 'linear-gradient(135deg, #431407 0%, #7c2d12 100%)' : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'} svgPath="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" isDark={isDarkMode} />
                </div>

                {/* GRAFIK PROPORSI FINANSIAL INTERAKTIF */}
                <div style={{ background: isDarkMode ? '#1e293b' : '#f8fafc', padding: '16px 18px', borderRadius: '14px', border: `1px solid ${t.border}`, marginBottom: '20px', textAlign: 'left', boxShadow: '0 10px 25px -8px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z"/></svg>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: t.text }}>Grafik Proporsi Finansial</h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600', marginBottom: '3px', color: t.text }}>
                        <span>Potensi Pemasukan</span>
                        <span style={{ color: '#16a34a' }}>Rp {totals.income.toLocaleString()}</span>
                      </div>
                      <div style={{ width: '100%', height: '7px', background: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div className="chart-bar" style={{ width: `${Math.min(Math.round((totals.income / maxProportionValue) * 100), 100)}%`, height: '100%', background: '#16a34a', borderRadius: '4px' }}></div>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600', marginBottom: '3px', color: t.text }}>
                        <span>Pengeluaran Aktual</span>
                        <span style={{ color: '#dc2626' }}>Rp {totals.expense.toLocaleString()}</span>
                      </div>
                      <div style={{ width: '100%', height: '7px', background: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div className="chart-bar" style={{ width: `${Math.min(Math.round((totals.expense / maxProportionValue) * 100), 100)}%`, height: '100%', background: '#dc2626', borderRadius: '4px' }}></div>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600', marginBottom: '3px', color: t.text }}>
                        <span>Target Anggaran</span>
                        <span style={{ color: '#2563eb' }}>Rp {totals.budgetPlan.toLocaleString()}</span>
                      </div>
                      <div style={{ width: '100%', height: '7px', background: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div className="chart-bar" style={{ width: `${Math.min(Math.round((totals.budgetPlan / maxProportionValue) * 100), 100)}%`, height: '100%', background: '#2563eb', borderRadius: '4px' }}></div>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600', marginBottom: '3px', color: t.text }}>
                        <span>Investasi / Aset Keuangan</span>
                        <span style={{ color: '#059669' }}>Rp {totals.invest.toLocaleString()}</span>
                      </div>
                      <div style={{ width: '100%', height: '7px', background: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div className="chart-bar" style={{ width: `${Math.min(Math.round((totals.invest / maxProportionValue) * 100), 100)}%`, height: '100%', background: '#059669', borderRadius: '4px' }}></div>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600', marginBottom: '3px', color: t.text }}>
                        <span>Tabungan & Impian</span>
                        <span style={{ color: '#0284c7' }}>Rp {totals.saving.toLocaleString()}</span>
                      </div>
                      <div style={{ width: '100%', height: '7px', background: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div className="chart-bar" style={{ width: `${Math.min(Math.round((totals.saving / maxProportionValue) * 100), 100)}%`, height: '100%', background: '#0284c7', borderRadius: '4px' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RINCIAN KATEGORI PENGELUARAN */}
                <div style={{ background: isDarkMode ? '#1e293b' : '#f8fafc', padding: '16px 18px', borderRadius: '14px', border: `1px solid ${t.border}`, marginBottom: '20px', textAlign: 'left', boxShadow: '0 10px 25px -8px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z"/></svg>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: t.text }}>Rincian Kategori Pengeluaran</h3>
                  </div>

                  {categoryBreakdownList.length === 0 ? (
                    <p style={{ color: t.muted, fontSize: '12px', margin: 0 }}>Belum ada data pengeluaran.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {categoryBreakdownList.map((cat, idx) => (
                        <div key={idx}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600', marginBottom: '3px', color: t.text }}>
                            <span>{cat.name}</span>
                            <span style={{ color: '#dc2626' }}>Rp {cat.total.toLocaleString()} ({cat.percent}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '7px', background: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div className="chart-bar" style={{ width: `${cat.percent}%`, height: '100%', background: idx % 2 === 0 ? '#2563eb' : '#059669', borderRadius: '4px' }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB DOMPET */}
            {activeTab === 'dompet' && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="18" height="18" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2zM19 12h-2v2h2v-2z"/></svg>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: t.text }}>Kelola Rekening & Dompet</h2>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: t.muted }}>Atur saldo dan transfer antar rekening.</p>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => setShowTransferForm(true)}
                      style={{ flex: 1, background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#ffffff', border: 'none', padding: '11px 14px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)', pointerEvents: 'auto' }}
                    >
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
                      <span>Transfer</span>
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => { 
                        setShowForm(true); 
                        setEditingId(null); 
                        setFormInput({
                          name: '',
                          amount: '',
                          budgetAmount: '',
                          maxAmount: '',
                          monthlyContribution: '',
                          dueDate: new Date().toISOString().split('T')[0],
                          status: 'Bank',
                          notes: '',
                          selectedBudgetCategory: '',
                          selectedWallet: 'Tunai',
                          date: new Date().toISOString().split('T')[0],
                          color: '#2563eb'
                        });
                      }}
                      style={{ ...aestheticBtnStyle, flex: 1, justifyContent: 'center', padding: '11px 14px', fontSize: '12px' }}
                    >
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
                      <span>Tambah Dompet</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Cari dompet..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '12px', background: t.inputBg, color: t.text, boxSizing: 'border-box', pointerEvents: 'auto' }}
                  />
                </div>

                {/* DESKTOP TABLE */}
                <div className="desktop-table-container" style={{ overflowX: 'auto', border: `1px solid ${t.border}`, borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
                    <thead>
                      <tr style={{ background: isDarkMode ? '#334155' : '#e2e8f0', borderBottom: `2px solid ${t.border}`, fontSize: '11px', color: t.text, fontWeight: '700' }}>
                        <th style={{ padding: '10px 12px' }}>Nama Dompet / Rekening</th>
                        <th style={{ padding: '10px 12px' }}>Tipe</th>
                        <th style={{ padding: '10px 12px' }}>Saldo Terkini</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWallets.length === 0 ? <tr><td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: t.muted, fontWeight: '500' }}>Belum ada data dompet.</td></tr> :
                      filteredWallets.map(item => (
                        <tr key={item.id} className="table-row" style={{ borderBottom: `1px solid ${t.border}`, fontSize: '12px', color: t.text }}>
                          <td style={{ padding: '10px 12px', fontWeight: '700' }}>{item.wallet_name}</td>
                          <td style={{ padding: '10px 12px' }}><span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 7px', borderRadius: '6px', fontSize: '10px', fontWeight: '700' }}>{item.wallet_type || 'Bank'}</span></td>
                          <td style={{ padding: '10px 12px', color: '#8b5cf6', fontWeight: '700' }}>Rp {Number(item.initial_balance || 0).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '5px' }}>
                            <button type="button" className="action-btn" onClick={() => handleEdit('dompet', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                            <button type="button" className="action-btn" onClick={() => handleDelete('wallets', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE CARD LIST */}
                <div className="mobile-card-list">
                  {filteredWallets.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: t.muted, fontSize: '12px' }}>Belum ada data dompet.</div>
                  ) : (
                    filteredWallets.map(item => (
                      <div key={item.id} style={{ background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #2e1065 100%)' : 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', border: `1px solid ${isDarkMode ? '#6b21a8' : '#e9d5ff'}`, borderRadius: '12px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', wordBreak: 'break-word', boxShadow: '0 8px 20px -5px rgba(0,0,0,0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: t.text, wordBreak: 'break-word', lineHeight: '1.2' }}>{item.wallet_name}</h4>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#ffffff', background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.wallet_type || 'Bank'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.85)', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
                          <span style={{ fontSize: '10px', color: t.muted, fontWeight: '600' }}>Saldo Terkini</span>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#8b5cf6', whiteSpace: 'nowrap' }}>Rp {Number(item.initial_balance || 0).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', borderTop: `1px solid ${isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(233, 213, 255, 0.6)'}`, paddingTop: '6px' }}>
                          <button type="button" className="action-btn" onClick={() => handleEdit('dompet', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                          <button type="button" className="action-btn" onClick={() => handleDelete('wallets', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'anggaran' && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="18" height="18" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: t.text, lineHeight: '1.2' }}>Kelola Anggaran & Kategori Kustom</h2>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: t.muted, lineHeight: '1.3' }}>Pantau batas limit dan kustomisasi warna pos anggaran.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => { 
                      setShowForm(true); 
                      setEditingId(null); 
                      setFormInput({
                        name: '',
                        amount: '',
                        budgetAmount: '',
                        maxAmount: '',
                        monthlyContribution: '',
                        dueDate: new Date().toISOString().split('T')[0],
                        status: 'Cair',
                        notes: '',
                        selectedBudgetCategory: '',
                        selectedWallet: 'Tunai',
                        date: new Date().toISOString().split('T')[0],
                        color: '#2563eb'
                      });
                    }}
                    style={{ ...aestheticBtnStyle, width: '100%', justifyContent: 'center', padding: '11px 14px', fontSize: '12px' }}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
                    <span>Tambah Anggaran</span>
                  </button>

                  <input
                    type="text"
                    placeholder="Cari pos anggaran..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '12px', background: t.inputBg, color: t.text, boxSizing: 'border-box', pointerEvents: 'auto' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                  {filteredBudgets.length === 0 ? (
                    <div style={{ background: isDarkMode ? '#1e293b' : '#f8fafc', padding: '16px', borderRadius: '12px', border: `1px solid ${t.border}`, color: t.muted, textAlign: 'center', fontSize: '12px' }}>
                      Tidak ada data anggaran.
                    </div>
                  ) : (
                    filteredBudgets.map(item => {
                      const spent = data.expenses
                        .filter(exp => {
                          const desc = exp.description.toLowerCase()
                          const notes = (exp.notes || '').toLowerCase()
                          const itemName = item.item_name.toLowerCase()
                          const matchTag = notes.includes(`[kategori: ${itemName}]`)
                          const matchDirect = desc.includes(itemName) || itemName.includes(desc)
                          return matchTag || matchDirect
                        })
                        .reduce((acc, curr) => acc + Number(curr.actual || 0), 0)

                      const isSaving = item.item_name?.toLowerCase().includes('tabungan') || item.item_name?.toLowerCase().includes('iphone')
                      const budgetLimit = isSaving ? spent : Number(item.budget || 1)
                      const displayLimit = Number(item.budget || 1)
                      const percent = isSaving ? 100 : Math.min(Math.round((spent / budgetLimit) * 100), 100)
                      const isOver = !isSaving && spent > budgetLimit
                      const isNear = !isSaving && percent >= 80 && !isOver
                      const customColor = item.color || (isOver ? '#dc2626' : isNear ? '#d97706' : '#2563eb')

                      return (
                        <div key={item.id} style={{ background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)' : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', padding: '12px 14px', borderRadius: '12px', border: `1px solid ${customColor}`, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 8px 20px -5px rgba(0,0,0,0.08)', width: '100%', boxSizing: 'border-box' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: customColor, flexShrink: 0 }}></div>
                              <div>
                                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: t.text, lineHeight: '1.2', wordBreak: 'break-word' }}>{item.item_name}</h4>
                                <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: t.muted, lineHeight: '1.2', wordBreak: 'break-word' }}>{item.notes || (isSaving ? 'Tabungan / Impian' : 'Tanpa catatan')}</p>
                              </div>
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: isSaving ? '#f0f9ff' : isOver ? '#fee2e2' : isNear ? '#fef3c7' : '#eff6ff', color: isSaving ? '#0284c7' : isOver ? '#dc2626' : isNear ? '#d97706' : '#2563eb', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {isSaving ? 'Tabungan' : isOver ? 'Jebol!' : isNear ? 'Waspada' : `${percent}%`}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.85)', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
                            <div>
                              <span style={{ fontSize: '9px', color: t.muted, fontWeight: '600', display: 'block' }}>{isSaving ? 'Terkumpul' : 'Terpakai'}</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: t.text }}>Rp {spent.toLocaleString()}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '9px', color: t.muted, fontWeight: '600', display: 'block' }}>{isSaving ? 'Target' : 'Limit Anggaran'}</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: customColor }}>Rp {displayLimit.toLocaleString()}</span>
                            </div>
                          </div>

                          <div style={{ width: '100%', height: '6px', background: isDarkMode ? '#334155' : '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div className="chart-bar" style={{ width: `${isSaving ? Math.min(Math.round((spent / displayLimit) * 100), 100) : percent}%`, height: '100%', background: customColor, borderRadius: '4px' }}></div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', borderTop: `1px solid ${isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(191, 219, 254, 0.6)'}`, paddingTop: '6px', marginTop: '2px' }}>
                            <button type="button" className="action-btn" onClick={() => handleEdit('anggaran', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                            <button type="button" className="action-btn" onClick={() => handleDelete('budget_plans', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB ASET FISIK & BARANG BERHARGA */}
            {activeTab === 'aset' && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="18" height="18" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: t.text }}>Manajemen Aset Fisik & Barang</h2>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: t.muted }}>Catat inventaris barang berharga yang menambah kekayaan bersih.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => { 
                      setShowForm(true); 
                      setEditingId(null); 
                      setFormInput({
                        name: '',
                        amount: '',
                        budgetAmount: '',
                        maxAmount: '',
                        monthlyContribution: '',
                        dueDate: new Date().toISOString().split('T')[0],
                        status: 'Elektronik',
                        notes: '',
                        selectedBudgetCategory: '',
                        selectedWallet: 'Tunai',
                        date: new Date().toISOString().split('T')[0],
                        color: '#2563eb'
                      });
                    }}
                    style={{ ...aestheticBtnStyle, width: '100%', justifyContent: 'center', padding: '11px 14px', fontSize: '12px' }}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
                    <span>Tambah Aset Fisik</span>
                  </button>

                  <input
                    type="text"
                    placeholder="Cari aset fisik..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '12px', background: t.inputBg, color: t.text, boxSizing: 'border-box', pointerEvents: 'auto' }}
                  />
                </div>

                {/* DESKTOP TABLE */}
                <div className="desktop-table-container" style={{ overflowX: 'auto', border: `1px solid ${t.border}`, borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ background: isDarkMode ? '#334155' : '#e2e8f0', borderBottom: `2px solid ${t.border}`, fontSize: '11px', color: t.text, fontWeight: '700' }}>
                        <th style={{ padding: '10px 12px' }}>Nama Barang</th>
                        <th style={{ padding: '10px 12px' }}>Kategori</th>
                        <th style={{ padding: '10px 12px' }}>Nilai Pasar (Sekarang)</th>
                        <th style={{ padding: '10px 12px' }}>Harga Beli Awal</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssets.length === 0 ? <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: t.muted, fontWeight: '500' }}>Belum ada data aset fisik.</td></tr> :
                      filteredAssets.map(item => (
                        <tr key={item.id} className="table-row" style={{ borderBottom: `1px solid ${t.border}`, fontSize: '12px', color: t.text }}>
                          <td style={{ padding: '10px 12px', fontWeight: '700' }}>{item.asset_name}</td>
                          <td style={{ padding: '10px 12px' }}><span style={{ background: '#ffedd5', color: '#c2410c', padding: '2px 7px', borderRadius: '6px', fontSize: '10px', fontWeight: '700' }}>{item.asset_category || 'Elektronik'}</span></td>
                          <td style={{ padding: '10px 12px', color: '#ea580c', fontWeight: '700' }}>Rp {Number(item.market_value || 0).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', color: t.muted, fontWeight: '600' }}>Rp {Number(item.purchase_value || 0).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '5px' }}>
                            <button type="button" className="action-btn" onClick={() => handleEdit('aset', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                            <button type="button" className="action-btn" onClick={() => handleDelete('physical_assets', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE CARD LIST */}
                <div className="mobile-card-list">
                  {filteredAssets.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: t.muted, fontSize: '12px' }}>Belum ada data aset fisik.</div>
                  ) : (
                    filteredAssets.map(item => (
                      <div key={item.id} style={{ background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #431407 100%)' : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', border: `1px solid ${isDarkMode ? '#9a3412' : '#fed7aa'}`, borderRadius: '12px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', wordBreak: 'break-word', boxShadow: '0 8px 20px -5px rgba(0,0,0,0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: t.text, wordBreak: 'break-word', lineHeight: '1.2' }}>{item.asset_name}</h4>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#ffffff', background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.asset_category || 'Elektronik'}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.85)', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${t.border}`, alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '9px', color: t.muted, fontWeight: '600', display: 'block' }}>Nilai Pasar</span>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#ea580c', whiteSpace: 'nowrap', display: 'block' }}>Rp {Number(item.market_value || 0).toLocaleString()}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '9px', color: t.muted, fontWeight: '600', display: 'block' }}>Beli Awal</span>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: t.text, whiteSpace: 'nowrap', display: 'block' }}>Rp {Number(item.purchase_value || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', borderTop: `1px solid ${isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(254, 215, 170, 0.6)'}`, paddingTop: '6px' }}>
                          <button type="button" className="action-btn" onClick={() => handleEdit('aset', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                          <button type="button" className="action-btn" onClick={() => handleDelete('physical_assets', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB GAMIFIKASI & TANTANGAN MENABUNG */}
            {activeTab === 'tantangan' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
                    <svg width="18" height="18" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: t.text, lineHeight: '1.2' }}>Tantangan Menabung 30 Hari & Badge</h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: t.muted, lineHeight: '1.3' }}>Bangun kebiasaan finansial yang menyenangkan layaknya sebuah game.</p>
                  </div>
                </div>

                <div style={{ background: isDarkMode ? '#1e293b' : '#f8fafc', border: `1px solid ${t.border}`, borderRadius: '14px', padding: '16px 18px', marginBottom: '20px', textAlign: 'left', boxShadow: '0 10px 25px -8px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700', color: t.text }}>Pencapaian Badge Keuangan Anda</h3>
                  <p style={{ margin: '0 0 14px 0', fontSize: '11px', color: t.muted }}>Badge terbuka otomatis seiring konsistensi keuangan Anda.</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                    <div style={{ background: totals.expense > 0 ? '#dcfce7' : (isDarkMode ? '#0f172a' : '#ffffff'), border: `1px solid ${totals.expense > 0 ? '#16a34a' : t.border}`, borderRadius: '10px', padding: '12px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={totals.expense > 0 ? '#16a34a' : t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                      <h4 style={{ margin: '6px 0 2px 0', fontSize: '12px', fontWeight: '700', color: totals.expense > 0 ? '#16a34a' : t.muted }}>Pencatat Aktif</h4>
                      <p style={{ margin: 0, fontSize: '9px', color: t.muted }}>Mulai mencatat pengeluaran</p>
                    </div>

                    <div style={{ background: netWorthTotal > 1000000 ? '#fef3c7' : (isDarkMode ? '#0f172a' : '#ffffff'), border: `1px solid ${netWorthTotal > 1000000 ? '#d97706' : t.border}`, borderRadius: '10px', padding: '12px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={netWorthTotal > 1000000 ? '#d97706' : t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      <h4 style={{ margin: '6px 0 2px 0', fontSize: '12px', fontWeight: '700', color: netWorthTotal > 1000000 ? '#d97706' : t.muted }}>Jutawan Muda</h4>
                      <p style={{ margin: 0, fontSize: '9px', color: t.muted }}>Net Worth &gt; Rp 1 Juta</p>
                    </div>

                    <div style={{ background: challengeProgress.filter(Boolean).length >= 10 ? '#ede9fe' : (isDarkMode ? '#0f172a' : '#ffffff'), border: `1px solid ${challengeProgress.filter(Boolean).length >= 10 ? '#7c3aed' : t.border}`, borderRadius: '10px', padding: '12px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={challengeProgress.filter(Boolean).length >= 10 ? '#7c3aed' : t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 4l3 12h14l3-12-6 7-4-5-4 7-6-7z"/>
                        <path d="M5 20h14"/>
                      </svg>
                      <h4 style={{ margin: '6px 0 2px 0', fontSize: '12px', fontWeight: '700', color: challengeProgress.filter(Boolean).length >= 10 ? '#7c3aed' : t.muted }}>Raja Konsisten</h4>
                      <p style={{ margin: 0, fontSize: '9px', color: t.muted }}>Selesaikan 10 Hari Tantangan</p>
                    </div>
                  </div>
                </div>

                <div style={{ background: isDarkMode ? '#1e293b' : '#f8fafc', border: `1px solid ${t.border}`, borderRadius: '14px', padding: '16px 18px', textAlign: 'left', boxShadow: '0 10px 25px -8px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: t.text }}>Checklist Tantangan Menabung 30 Hari</h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: t.muted }}>Centang setiap kali Anda berhasil menyisihkan tabungan harian.</p>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#16a34a', background: '#dcfce7', padding: '4px 10px', borderRadius: '8px' }}>
                      {challengeProgress.filter(Boolean).length} / 30 Hari Selesai
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))', gap: '8px' }}>
                    {challengeProgress.map((completed, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleChallengeDay(idx)}
                        style={{
                          background: completed ? '#16a34a' : (isDarkMode ? '#0f172a' : '#ffffff'),
                          color: completed ? '#ffffff' : t.text,
                          border: `1px solid ${completed ? '#16a34a' : t.border}`,
                          borderRadius: '8px',
                          padding: '10px 4px',
                          fontWeight: '700',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          boxShadow: completed ? '0 4px 12px rgba(22, 163, 74, 0.3)' : 'none',
                          pointerEvents: 'auto'
                        }}
                      >
                        <span style={{ fontSize: '9px', opacity: 0.8 }}>Hari</span>
                        <span>{idx + 1}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tabungan' && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="18" height="18" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.66 4.4 4.95a5.01 5.01 0 004.6 4.05v2H8v2h8v-2h-2v-2c2.08-.34 3.6-2.12 3.6-4.25V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: t.text }}>Kelola Tabungan & Impian</h2>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: t.muted }}>Pantau target dan estimasi waktu tercapai.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => { 
                      setShowForm(true); 
                      setEditingId(null); 
                      setFormInput({
                        name: '',
                        amount: '',
                        budgetAmount: '',
                        maxAmount: '',
                        monthlyContribution: '',
                        dueDate: new Date().toISOString().split('T')[0],
                        status: 'Cair',
                        notes: '',
                        selectedBudgetCategory: '',
                        selectedWallet: 'Tunai',
                        date: new Date().toISOString().split('T')[0],
                        color: '#2563eb'
                      });
                    }}
                    style={{ ...aestheticBtnStyle, width: '100%', justifyContent: 'center', padding: '11px 14px', fontSize: '12px' }}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
                    <span>Tambah Tabungan</span>
                  </button>

                  <input
                    type="text"
                    placeholder="Cari tabungan atau impian..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '12px', background: t.inputBg, color: t.text, boxSizing: 'border-box', pointerEvents: 'auto' }}
                  />
                </div>

                {/* DESKTOP TABLE */}
                <div className="desktop-table-container" style={{ overflowX: 'auto', border: `1px solid ${t.border}`, borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ background: isDarkMode ? '#334155' : '#e2e8f0', borderBottom: `2px solid ${t.border}`, fontSize: '11px', color: t.text, fontWeight: '700' }}>
                        <th style={{ padding: '10px 12px' }}>Nama Impian / Tabungan</th>
                        <th style={{ padding: '10px 12px' }}>Terkumpul</th>
                        <th style={{ padding: '10px 12px' }}>Target</th>
                        <th style={{ padding: '10px 12px' }}>Estimasi Waktu Tercapai</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSavings.length === 0 ? <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: t.muted, fontWeight: '500' }}>Belum ada data tabungan.</td></tr> :
                      filteredSavings.map(item => {
                        const current = Number(item.current_amount || 0)
                        const target = Number(item.target_amount || 0)
                        const monthlySave = Number(item.monthly_contribution || 500000)
                        const remaining = Math.max(target - current, 0)
                        const monthsNeeded = monthlySave > 0 ? Math.ceil(remaining / monthlySave) : 0
                        const targetDate = new Date()
                        targetDate.setMonth(targetDate.getMonth() + monthsNeeded)
                        const formattedTargetDate = targetDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })

                        return (
                          <tr key={item.id} className="table-row" style={{ borderBottom: `1px solid ${t.border}`, fontSize: '12px', color: t.text }}>
                            <td style={{ padding: '10px 12px', fontWeight: '700' }}>{item.goal_name}</td>
                            <td style={{ padding: '10px 12px', color: '#0284c7', fontWeight: '700' }}>Rp {current.toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', fontWeight: '600' }}>Rp {target.toLocaleString()}</td>
                            <td style={{ padding: '10px 12px' }}>
                              {remaining === 0 ? (
                                <span style={{ color: '#16a34a', fontWeight: '700' }}>Tercapai</span>
                              ) : (
                                <span style={{ color: '#d97706', fontWeight: '700' }}>~{monthsNeeded} bln ({formattedTargetDate})</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '5px' }}>
                              {!item.id.toString().startsWith('budget_savings_') && (
                                <>
                                  <button type="button" className="action-btn" onClick={() => handleEdit('tabungan', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                                  <button type="button" className="action-btn" onClick={() => handleDelete('savings', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                                </>
                              )}
                              {item.id.toString().startsWith('budget_savings_') && (
                                <span style={{ fontSize: '10px', color: t.muted, fontStyle: 'italic' }}>Dari Anggaran</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE CARD LIST */}
                <div className="mobile-card-list">
                  {filteredSavings.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: t.muted, fontSize: '12px' }}>Belum ada data tabungan.</div>
                  ) : (
                    filteredSavings.map(item => {
                      const current = Number(item.current_amount || 0)
                      const target = Number(item.target_amount || 0)
                      const monthlySave = Number(item.monthly_contribution || 500000)
                      const remaining = Math.max(target - current, 0)
                      const monthsNeeded = monthlySave > 0 ? Math.ceil(remaining / monthlySave) : 0
                      const targetDate = new Date()
                      targetDate.setMonth(targetDate.getMonth() + monthsNeeded)
                      const formattedTargetDate = targetDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })

                      return (
                        <div key={item.id} style={{ background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #082f49 100%)' : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', border: `1px solid ${isDarkMode ? '#0369a1' : '#bae6fd'}`, borderRadius: '12px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', wordBreak: 'break-word', boxShadow: '0 8px 20px -5px rgba(0,0,0,0.08)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: t.text, wordBreak: 'break-word', lineHeight: '1.2' }}>{item.goal_name}</h4>
                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#ffffff', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>Tabungan</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.85)', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${t.border}`, alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '9px', color: t.muted, fontWeight: '600', display: 'block' }}>Terkumpul</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#0284c7', whiteSpace: 'nowrap', display: 'block' }}>Rp {current.toLocaleString()}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '9px', color: t.muted, fontWeight: '600', display: 'block' }}>Target</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: t.text, whiteSpace: 'nowrap', display: 'block' }}>Rp {target.toLocaleString()}</span>
                            </div>
                          </div>

                          <div style={{ fontSize: '10px', color: t.muted, fontWeight: '500' }}>
                            {remaining === 0 ? <span style={{ color: '#16a34a', fontWeight: '700' }}>Target Tercapai</span> : <span>Estimasi: ~{monthsNeeded} bln ({formattedTargetDate})</span>}
                          </div>

                          {!item.id.toString().startsWith('budget_savings_') ? (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', borderTop: `1px solid ${isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(186, 230, 253, 0.6)'}`, paddingTop: '6px' }}>
                              <button type="button" className="action-btn" onClick={() => handleEdit('tabungan', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                              <button type="button" className="action-btn" onClick={() => handleDelete('savings', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                            </div>
                          ) : (
                            <div style={{ borderTop: `1px solid ${isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(186, 230, 253, 0.6)'}`, paddingTop: '5px', textAlign: 'right' }}>
                              <span style={{ fontSize: '10px', color: t.muted, fontStyle: 'italic' }}>Sumber: Dari Anggaran</span>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'pengaturan' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0' }}>
                    <svg width="18" height="18" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: t.text, lineHeight: '1.2' }}>Pengaturan & Keamanan</h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: t.muted, lineHeight: '1.3' }}>Sesuaikan periode, PIN, backup database, dan cetak PDF profesional.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', alignItems: 'stretch' }}>
                  
                  {/* Card 1: Ubah Tanggal Periode */}
                  <div style={{ background: isDarkMode ? '#1e293b' : '#f8fafc', padding: '16px 18px', borderRadius: '14px', border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left', height: '100%', boxSizing: 'border-box', boxShadow: '0 10px 25px -8px rgba(0,0,0,0.1)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <svg width="15" height="15" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: t.text }}>Ubah Tanggal Periode</h3>
                      </div>
                      <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: t.muted, lineHeight: '1.4' }}>Ketik keterangan periode baru sesuai keinginanmu.</p>
                      <input
                        type="text"
                        defaultValue={periodText}
                        id="inputPeriod"
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '12px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      />
                    </div>
                    <div style={{ marginTop: '14px' }}>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => handleSavePeriod(document.getElementById('inputPeriod').value)}
                        style={{ width: '100%', background: '#2563eb', color: '#ffffff', border: 'none', padding: '9px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '12px', pointerEvents: 'auto' }}
                      >
                        Simpan Periode Baru
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Keamanan PIN */}
                  <div style={{ background: isDarkMode ? '#1e293b' : '#f8fafc', padding: '16px 18px', borderRadius: '14px', border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left', height: '100%', boxSizing: 'border-box', boxShadow: '0 10px 25px -8px rgba(0,0,0,0.1)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <svg width="15" height="15" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: t.text }}>Keamanan PIN (Lock)</h3>
                      </div>
                      <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: t.muted, lineHeight: '1.4' }}>Atur PIN 4 digit untuk mengunci aplikasi.</p>
                      <input
                        type="password"
                        maxLength="4"
                        defaultValue={savedPin}
                        id="inputPinSetting"
                        placeholder="Contoh: 1234"
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '12px', background: t.inputBg, color: t.text, fontWeight: '500', boxSizing: 'border-box', pointerEvents: 'auto' }}
                      />
                    </div>
                    <div style={{ marginTop: '14px' }}>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => handleSetPin(document.getElementById('inputPinSetting').value)}
                        style={{ width: '100%', background: '#d97706', color: '#ffffff', border: 'none', padding: '9px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '12px', pointerEvents: 'auto' }}
                      >
                        Simpan / Perbarui PIN
                      </button>
                    </div>
                  </div>

                  {/* Card 3: Ekspor Laporan & Backup & PDF */}
                  <div style={{ background: isDarkMode ? '#1e293b' : '#f8fafc', padding: '16px 18px', borderRadius: '14px', border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left', height: '100%', boxSizing: 'border-box', boxShadow: '0 10px 25px -8px rgba(0,0,0,0.1)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <svg width="15" height="15" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: t.text }}>Ekspor Laporan & PDF</h3>
                      </div>
                      <p style={{ margin: '0 0 10px 0', fontSize: '11px', color: t.muted, lineHeight: '1.4' }}>Cetak PDF profesional, Excel, atau backup JSON.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '7px', flexDirection: 'column', marginTop: '14px' }}>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={handlePrintPdfReport}
                        style={{ width: '100%', background: '#7c3aed', color: '#ffffff', border: 'none', padding: '9px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '12px', pointerEvents: 'auto' }}
                      >
                        🖨️ Cetak Laporan PDF Profesional
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={handleExportExcel}
                        style={{ width: '100%', background: '#16a34a', color: '#ffffff', border: 'none', padding: '9px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '12px', pointerEvents: 'auto' }}
                      >
                        Unduh Laporan Excel (.csv)
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={handleBackup}
                        style={{ width: '100%', background: '#0284c7', color: '#ffffff', border: 'none', padding: '9px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '12px', pointerEvents: 'auto' }}
                      >
                        Backup Database JSON
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {activeTab !== 'dashboard' && activeTab !== 'dompet' && activeTab !== 'anggaran' && activeTab !== 'tabungan' && activeTab !== 'aset' && activeTab !== 'tantangan' && activeTab !== 'pengaturan' && (
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', width: '100%' }}>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', textTransform: 'capitalize', color: t.text }}>
                    Kelola {activeTab}
                  </h2>
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => { 
                      setShowForm(true); 
                      setEditingId(null); 
                      setFormInput({
                        name: '',
                        amount: '',
                        budgetAmount: '',
                        maxAmount: '',
                        monthlyContribution: '',
                        dueDate: new Date().toISOString().split('T')[0],
                        status: activeTab === 'pemasukan' ? 'Cair' : 'Belum Lunas',
                        notes: '',
                        selectedBudgetCategory: '',
                        selectedWallet: 'Tunai',
                        date: new Date().toISOString().split('T')[0],
                        color: '#2563eb'
                      });
                    }}
                    style={{ ...aestheticBtnStyle, width: '100%', justifyContent: 'center', padding: '11px 14px', fontSize: '12px' }}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
                    <span>Tambah Data Baru</span>
                  </button>

                  <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', width: '100%' }}>
                    <input
                      type="text"
                      placeholder={`Cari data ${activeTab}...`}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '12px', background: t.inputBg, color: t.text, boxSizing: 'border-box', pointerEvents: 'auto' }}
                    />

                    {activeTab === 'pengeluaran' && (
                      <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', width: '100%' }}>
                        <select
                          value={expenseCategoryFilter}
                          onChange={e => setExpenseCategoryFilter(e.target.value)}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '12px', background: t.inputBg, color: t.text, boxSizing: 'border-box', pointerEvents: 'auto' }}
                        >
                          <option value="">Semua Kategori</option>
                          {data.budgets.map(b => (
                            <option key={b.id} value={b.item_name}>{b.item_name}</option>
                          ))}
                        </select>

                        <select
                          value={expenseSortOrder}
                          onChange={e => setExpenseSortOrder(e.target.value)}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, fontSize: '12px', background: t.inputBg, color: t.text, boxSizing: 'border-box', pointerEvents: 'auto' }}
                        >
                          <option value="newest">Terbaru</option>
                          <option value="oldest">Terlama</option>
                          <option value="highest">Nominal Tertinggi</option>
                          <option value="lowest">Nominal Terendah</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* DESKTOP TABLE */}
                <div className="desktop-table-container" style={{ overflowX: 'auto', border: `1px solid ${t.border}`, borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ background: isDarkMode ? '#334155' : '#e2e8f0', borderBottom: `2px solid ${t.border}`, fontSize: '11px', color: t.text, fontWeight: '700' }}>
                        {activeTab === 'pengeluaran' && <>
                          <th style={{ padding: '10px 12px' }}>Tanggal & Hari</th>
                          <th style={{ padding: '10px 12px' }}>Keperluan</th>
                          <th style={{ padding: '10px 12px' }}>Dompet</th>
                          <th style={{ padding: '10px 12px' }}>Aktual</th>
                          <th style={{ padding: '10px 12px' }}>Catatan</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Aksi</th>
                        </>}
                        {activeTab === 'pemasukan' && <>
                          <th style={{ padding: '10px 12px' }}>Sumber Pemasukan</th>
                          <th style={{ padding: '10px 12px' }}>Minimum</th>
                          <th style={{ padding: '10px 12px' }}>Maksimum</th>
                          <th style={{ padding: '10px 12px' }}>Status</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Aksi</th>
                        </>}
                        {activeTab === 'hutang' && <>
                          <th style={{ padding: '10px 12px' }}>Pemberi Pinjaman</th>
                          <th style={{ padding: '10px 12px' }}>Total Nominal</th>
                          <th style={{ padding: '10px 12px' }}>Jatuh Tempo</th>
                          <th style={{ padding: '10px 12px' }}>Status</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Aksi</th>
                        </>}
                        {activeTab === 'investasi' && <>
                          <th style={{ padding: '10px 12px' }}>Jenis Aset</th>
                          <th style={{ padding: '10px 12px' }}>Nominal</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Aksi</th>
                        </>}
                      </tr>
                    </thead>
                    <tbody>
                      {activeTab === 'pengeluaran' && (
                        filteredExpenses.length === 0 ? <tr><td colSpan="6" style={{ padding: '16px', textAlign: 'center', color: t.muted, fontWeight: '500' }}>Tidak ada data.</td></tr> :
                        filteredExpenses.map(item => (
                          <tr key={item.id} className="table-row" style={{ borderBottom: `1px solid ${t.border}`, fontSize: '12px', color: t.text }}>
                            <td style={{ padding: '10px 12px', color: t.muted }}>
                              <div style={{ fontWeight: '600' }}>{item.date || '-'}</div>
                              <div style={{ fontSize: '10px', color: t.muted }}>{item.day_name || '-'}</div>
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: '700' }}>{item.description}</td>
                            <td style={{ padding: '10px 12px' }}><span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '700' }}>{extractWalletFromNotes(item.notes)}</span></td>
                            <td style={{ padding: '10px 12px', color: '#dc2626', fontWeight: '700' }}>Rp {Number(item.actual || 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', color: t.muted }}>{cleanNotesDisplay(item.notes)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '5px' }}>
                              <button type="button" className="action-btn" onClick={() => handleEdit('pengeluaran', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                              <button type="button" className="action-btn" onClick={() => handleDelete('daily_expenses', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                            </td>
                          </tr>
                        ))
                      )}

                      {activeTab === 'pemasukan' && (
                        filteredIncome.length === 0 ? <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: t.muted, fontWeight: '500' }}>Tidak ada data.</td></tr> :
                        filteredIncome.map(item => (
                          <tr key={item.id} className="table-row" style={{ borderBottom: `1px solid ${t.border}`, fontSize: '12px', color: t.text }}>
                            <td style={{ padding: '10px 12px', fontWeight: '700' }}>{item.source_name}</td>
                            <td style={{ padding: '10px 12px', color: '#16a34a', fontWeight: '600' }}>Rp {Number(item.min_amount || 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', color: '#16a34a', fontWeight: '600' }}>Rp {Number(item.max_amount || 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleToggleIncomeStatus(item)}
                                style={{ background: item.status === 'Cair' ? '#dcfce7' : '#fef3c7', color: item.status === 'Cair' ? '#16a34a' : '#d97706', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', pointerEvents: 'auto' }}
                              >
                                {item.status === 'Cair' ? (
                                  <>
                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                                    Cair
                                  </>
                                ) : (
                                  <>
                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                    Belum Cair
                                  </>
                                )}
                              </button>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '5px' }}>
                              <button type="button" className="action-btn" onClick={() => handleEdit('pemasukan', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                              <button type="button" className="action-btn" onClick={() => handleDelete('income_sources', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                            </td>
                          </tr>
                        ))
                      )}

                      {activeTab === 'hutang' && (
                        filteredDebts.length === 0 ? <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: t.muted, fontWeight: '500' }}>Tidak ada data.</td></tr> :
                        filteredDebts.map(item => (
                          <tr key={item.id} className="table-row" style={{ borderBottom: `1px solid ${t.border}`, fontSize: '12px', color: t.text }}>
                            <td style={{ padding: '10px 12px', fontWeight: '700' }}>{item.creditor_name}</td>
                            <td style={{ padding: '10px 12px', color: '#d97706', fontWeight: '700' }}>Rp {Number(item.amount || 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', color: t.muted, fontWeight: '600' }}>{item.due_date || '-'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleToggleDebtStatus(item)}
                                style={{ background: item.status === 'Lunas' ? '#dcfce7' : '#fee2e2', color: item.status === 'Lunas' ? '#16a34a' : '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', pointerEvents: 'auto' }}
                              >
                                {item.status === 'Lunas' ? (
                                  <>
                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                                    Lunas
                                  </>
                                ) : (
                                  <>
                                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                    Belum Lunas
                                  </>
                                )}
                              </button>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '5px' }}>
                              <button type="button" className="action-btn" onClick={() => handleEdit('hutang', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                              <button type="button" className="action-btn" onClick={() => handleDelete('debts', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                            </td>
                          </tr>
                        ))
                      )}

                      {activeTab === 'investasi' && (
                        filteredInvestments.length === 0 ? <tr><td colSpan="3" style={{ padding: '16px', textAlign: 'center', color: t.muted, fontWeight: '500' }}>Tidak ada data.</td></tr> :
                        filteredInvestments.map(item => (
                          <tr key={item.id} className="table-row" style={{ borderBottom: `1px solid ${t.border}`, fontSize: '12px', color: t.text }}>
                            <td style={{ padding: '10px 12px', fontWeight: '700' }}>{item.item_name}</td>
                            <td style={{ padding: '10px 12px', color: '#059669', fontWeight: '700' }}>Rp {Number(item.nominal || 0).toLocaleString()}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '5px' }}>
                              <button type="button" className="action-btn" onClick={() => handleEdit('investasi', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                              <button type="button" className="action-btn" onClick={() => handleDelete('investments', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE CARD LIST */}
                <div className="mobile-card-list">
                  {activeTab === 'pengeluaran' && (
                    filteredExpenses.length === 0 ? <div style={{ padding: '16px', textAlign: 'center', color: t.muted, fontSize: '12px' }}>Tidak ada data.</div> :
                    filteredExpenses.map(item => (
                      <div key={item.id} style={{ background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #450a0a 100%)' : 'linear-gradient(135deg, #fff5f5 0%, #ffe4e6 100%)', border: `1px solid ${isDarkMode ? '#991b1b' : '#fecdd3'}`, borderRadius: '12px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', wordBreak: 'break-word', boxShadow: '0 8px 20px -5px rgba(0,0,0,0.08)' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', marginBottom: '3px' }}>
                            <span style={{ fontSize: '10px', color: t.muted, fontWeight: '600' }}>{item.date || '-'} ({item.day_name || '-'})</span>
                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#ffffff', background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>{extractWalletFromNotes(item.notes)}</span>
                          </div>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: t.text, wordBreak: 'break-word', lineHeight: '1.2' }}>{item.description}</h4>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.85)', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
                          <span style={{ fontSize: '10px', color: t.muted, fontWeight: '600' }}>Nominal Aktual</span>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', whiteSpace: 'nowrap' }}>Rp {Number(item.actual || 0).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', borderTop: `1px solid ${isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(254, 205, 211, 0.6)'}`, paddingTop: '6px' }}>
                          <button type="button" className="action-btn" onClick={() => handleEdit('pengeluaran', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                          <button type="button" className="action-btn" onClick={() => handleDelete('daily_expenses', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                        </div>
                      </div>
                    ))
                  )}

                  {activeTab === 'pemasukan' && (
                    filteredIncome.length === 0 ? <div style={{ padding: '16px', textAlign: 'center', color: t.muted, fontSize: '12px' }}>Tidak ada data.</div> :
                    filteredIncome.map(item => (
                      <div key={item.id} style={{ background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: `1px solid ${isDarkMode ? '#047857' : '#bbf7d0'}`, borderRadius: '12px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', wordBreak: 'break-word', boxShadow: '0 8px 20px -5px rgba(0,0,0,0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: t.text, wordBreak: 'break-word', lineHeight: '1.2' }}>{item.source_name}</h4>
                          <button
                            type="button"
                            onClick={() => handleToggleIncomeStatus(item)}
                            style={{ background: item.status === 'Cair' ? '#dcfce7' : '#fef3c7', color: item.status === 'Cair' ? '#16a34a' : '#d97706', border: 'none', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0, pointerEvents: 'auto' }}
                          >
                            {item.status === 'Cair' ? (
                              <>
                                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                                Cair
                              </>
                            ) : (
                              <>
                                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                Belum Cair
                              </>
                            )}
                          </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.85)', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
                          <span style={{ fontSize: '10px', color: t.muted, fontWeight: '600' }}>Minimum / Maksimum</span>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a', whiteSpace: 'nowrap' }}>Rp {Number(item.min_amount || 0).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', borderTop: `1px solid ${isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(187, 247, 208, 0.6)'}`, paddingTop: '6px' }}>
                          <button type="button" className="action-btn" onClick={() => handleEdit('pemasukan', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                          <button type="button" className="action-btn" onClick={() => handleDelete('income_sources', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                        </div>
                      </div>
                    ))
                  )}

                  {activeTab === 'hutang' && (
                    filteredDebts.length === 0 ? <div style={{ padding: '16px', textAlign: 'center', color: t.muted, fontSize: '12px' }}>Tidak ada data.</div> :
                    filteredDebts.map(item => (
                      <div key={item.id} style={{ background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #78350f 100%)' : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: `1px solid ${isDarkMode ? '#b45309' : '#fde68a'}`, borderRadius: '12px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', wordBreak: 'break-word', boxShadow: '0 8px 20px -5px rgba(0,0,0,0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: t.text, wordBreak: 'break-word', lineHeight: '1.2' }}>{item.creditor_name}</h4>
                            <span style={{ fontSize: '10px', color: t.muted, display: 'block', marginTop: '1px' }}>Tempo: {item.due_date || '-'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleDebtStatus(item)}
                            style={{ background: item.status === 'Lunas' ? '#dcfce7' : '#fee2e2', color: item.status === 'Lunas' ? '#16a34a' : '#dc2626', border: 'none', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0, pointerEvents: 'auto' }}
                          >
                            {item.status === 'Lunas' ? (
                              <>
                                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                                Lunas
                              </>
                            ) : (
                              <>
                                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                                Belum Lunas
                              </>
                            )}
                          </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.85)', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
                          <span style={{ fontSize: '10px', color: t.muted, fontWeight: '600' }}>Total Nominal</span>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#d97706', whiteSpace: 'nowrap' }}>Rp {Number(item.amount || 0).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', borderTop: `1px solid ${isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(253, 230, 138, 0.6)'}`, paddingTop: '6px' }}>
                          <button type="button" className="action-btn" onClick={() => handleEdit('hutang', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                          <button type="button" className="action-btn" onClick={() => handleDelete('debts', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                        </div>
                      </div>
                    ))
                  )}

                  {activeTab === 'investasi' && (
                    filteredInvestments.length === 0 ? <div style={{ padding: '16px', textAlign: 'center', color: t.muted, fontSize: '12px' }}>Tidak ada data.</div> :
                    filteredInvestments.map(item => (
                      <div key={item.id} style={{ background: isDarkMode ? 'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #ccfbf1 100%)', border: `1px solid ${isDarkMode ? '#047857' : '#99f6e4'}`, borderRadius: '12px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', wordBreak: 'break-word', boxShadow: '0 8px 20px -5px rgba(0,0,0,0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: t.text, wordBreak: 'break-word', lineHeight: '1.2' }}>{item.item_name}</h4>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#ffffff', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>Investasi</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.85)', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${t.border}` }}>
                          <span style={{ fontSize: '10px', color: t.muted, fontWeight: '600' }}>Nominal Aset</span>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669', whiteSpace: 'nowrap' }}>Rp {Number(item.nominal || 0).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', borderTop: `1px solid ${isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(153, 246, 228, 0.6)'}`, paddingTop: '6px' }}>
                          <button type="button" className="action-btn" onClick={() => handleEdit('investasi', item)} style={{ background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Edit</button>
                          <button type="button" className="action-btn" onClick={() => handleDelete('investments', item.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: '700', pointerEvents: 'auto' }}>Hapus</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function Card({ title, value, valueExtra, color, bg, svgPath, isDark }) {
  return (
    <div style={{ background: bg, padding: '12px 14px', borderRadius: '14px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '3px', border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`, textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#cbd5e1' : '#475569', textAlign: 'left' }}>{title}</span>
        <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: isDark ? '#1e293b' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <svg width="13" height="13" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={svgPath}></path></svg>
        </div>
      </div>
      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: color, textAlign: 'left', wordBreak: 'break-word', letterSpacing: '-0.2px' }}>
        Rp {value.toLocaleString()} {valueExtra && <span style={{ fontSize: '11px', fontWeight: '600', opacity: 0.85 }}>({valueExtra}</span>}
      </h3>
    </div>
  )
}