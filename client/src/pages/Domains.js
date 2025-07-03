import React, { useState } from 'react';
import { domainAPI } from '../services/api'; // Make sure this import exists

function Domains() {
  const [form, setForm] = useState({
    domainName: '',
    expiryDate: '',
    registrar: '',
    purchaseLocation: '',
    purchaseDate: '',
    cost: '',
    notes: ''
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await domainAPI.create(form);
      setMessage('Domain added successfully!');
    } catch (err) {
      setMessage('Failed to add domain.');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Domains</h1>
      <form onSubmit={handleSubmit} className="mb-4 space-y-2">
        <input name="domainName" placeholder="Domain Name" value={form.domainName} onChange={handleChange} required className="input" />
        <input name="expiryDate" type="date" placeholder="Expiry Date" value={form.expiryDate} onChange={handleChange} required className="input" />
        <input name="registrar" placeholder="Registrar" value={form.registrar} onChange={handleChange} className="input" />
        <input name="purchaseLocation" placeholder="Purchase Location" value={form.purchaseLocation} onChange={handleChange} className="input" />
        <input name="purchaseDate" type="date" placeholder="Purchase Date" value={form.purchaseDate} onChange={handleChange} className="input" />
        <input name="cost" type="number" step="0.01" placeholder="Cost" value={form.cost} onChange={handleChange} className="input" />
        <input name="notes" placeholder="Notes" value={form.notes} onChange={handleChange} className="input" />
        <button type="submit" className="btn btn-primary">Add Domain</button>
      </form>
      {message && <div>{message}</div>}
      {/* TODO: List domains here */}
    </div>
  );
}

export default Domains; 