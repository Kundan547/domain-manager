import React from 'react';
import { useParams } from 'react-router-dom';

function DomainDetail() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Domain Detail</h1>
      <p className="text-gray-600">Viewing details for domain ID: <span className="font-mono">{id}</span></p>
      {/* TODO: Implement domain detail view and edit functionality */}
    </div>
  );
}

export default DomainDetail; 