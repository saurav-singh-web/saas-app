import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

function CreateOrg({ onCreated, showToast }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [country, setCountry] = useState('')
  const [countries, setCountries] = useState([])

  useEffect(() => {
    fetchCountries()
  }, [])

  async function fetchCountries() {
    const response = await fetch('https://restcountries.com/v3.1/all?fields=name')
    const data = await response.json()
    const sorted = data.map(c => c.name.common).sort()
    setCountries(sorted)
  }

  function handleNameChange(e) {
    const value = e.target.value
    setName(value)
    setSlug(value.toLowerCase().replace(/\s+/g, '-'))
  }

  async function handleCreate() {
    if (!country) {
      showToast('Please select a country.', 'error')
      return
    }

    const { error } = await supabase
      .from('organizations')
      .insert({ name, slug, country })

    if (error) {
      showToast(error.message, 'error')
      return
    }

    showToast('Organization created successfully!', 'success')
    setName('')
    setSlug('')
    setCountry('')
    if (onCreated) onCreated()
  }

 return (
  <div className="w-full">

    <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">
      Create an Organization
    </h2>

    <div className="space-y-3 w-full max-w-md">

      <input
        type="text"
        placeholder="Organization name"
        value={name}
        onChange={handleNameChange}
        className="w-full bg-gray-800/60 border border-gray-700 text-white rounded-lg px-3 sm:px-4 py-2.5 text-sm 
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
      />

      <input
        type="text"
        placeholder="Slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        className="w-full bg-gray-800/60 border border-gray-700 text-white rounded-lg px-3 sm:px-4 py-2.5 text-sm 
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
      />

      <select
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        className="w-full bg-gray-800/60 border border-gray-700 text-white rounded-lg px-3 sm:px-4 py-2.5 text-sm 
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
      >
        <option value="">Select a country</option>
        {countries.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <button
        onClick={handleCreate}
        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 
        text-white text-sm font-medium rounded-lg px-5 py-2.5 
        transition active:scale-95 shadow-md shadow-indigo-600/20"
      >
        Create
      </button>

    </div>
  </div>
)
}

export default CreateOrg