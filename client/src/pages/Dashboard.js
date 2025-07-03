import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  GlobeAltIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { domainAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6b7280'];

function Dashboard() {
  const { data: domainsData, isLoading: domainsLoading } = useQuery('domains', domainAPI.getAll);
  const { data: statsData, isLoading: statsLoading } = useQuery('domainStats', domainAPI.getStats);
  const { data: expiringData, isLoading: expiringLoading } = useQuery('expiringDomains', () => 
    domainAPI.getExpiringSoon(30)
  );

  const isLoading = domainsLoading || statsLoading || expiringLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const domains = domainsData?.domains || [];
  const stats = statsData?.stats || {};
  const expiringDomains = expiringData?.domains || [];

  // Prepare chart data
  const statusData = [
    { name: 'Active', value: stats.active_domains || 0 },
    { name: 'Expiring Soon', value: stats.expiring_soon || 0 },
    { name: 'Expired', value: stats.expired_domains || 0 },
    { name: 'Inactive', value: (stats.total_domains || 0) - (stats.active_domains || 0) - (stats.expired_domains || 0) },
  ];

  const sslData = [
    { name: 'Valid SSL', value: (stats.total_ssl || 0) - (stats.expired_ssl || 0) - (stats.expiring_ssl_soon || 0) },
    { name: 'Expiring Soon', value: stats.expiring_ssl_soon || 0 },
    { name: 'Expired SSL', value: stats.expired_ssl || 0 },
    { name: 'No SSL', value: (stats.total_domains || 0) - (stats.total_ssl || 0) },
  ];

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="card">
      <div className="card-body">
        <div className="flex items-center">
          <div className={`flex-shrink-0 p-3 rounded-md ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="text-lg font-medium text-gray-900">{value}</dd>
              {subtitle && <dd className="text-sm text-gray-500">{subtitle}</dd>}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'text-success-600 bg-success-100';
      case 'expired':
        return 'text-danger-600 bg-danger-100';
      case 'expiring_soon':
        return 'text-warning-600 bg-warning-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your domain portfolio and monitoring status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Domains"
          value={stats.total_domains || 0}
          icon={GlobeAltIcon}
          color="bg-primary-500"
        />
        <StatCard
          title="Active Domains"
          value={stats.active_domains || 0}
          icon={CheckCircleIcon}
          color="bg-success-500"
        />
        <StatCard
          title="Expiring Soon"
          value={stats.expiring_soon || 0}
          icon={ExclamationTriangleIcon}
          color="bg-warning-500"
        />
        <StatCard
          title="Total Cost"
          value={`$${(stats.total_cost || 0).toFixed(2)}`}
          icon={ArrowTrendingUpIcon}
          color="bg-purple-500"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Domain Status Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Domain Status Distribution</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* SSL Status Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">SSL Certificate Status</h3>
          </div>
          <div className="card-body">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sslData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sslData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Expiring Domains */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Domains Expiring Soon</h3>
          <p className="mt-1 text-sm text-gray-500">
            Domains that will expire in the next 30 days
          </p>
        </div>
        <div className="card-body">
          {expiringDomains.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircleIcon className="mx-auto h-12 w-12 text-success-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No domains expiring soon</h3>
              <p className="mt-1 text-sm text-gray-500">
                All your domains are up to date.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Domain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registrar
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expiry Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Left
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {expiringDomains.slice(0, 5).map((domain) => {
                    const daysLeft = Math.ceil((new Date(domain.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={domain.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <GlobeAltIcon className="h-5 w-5 text-gray-400 mr-2" />
                            <Link
                              to={`/domains/${domain.id}`}
                              className="text-sm font-medium text-primary-600 hover:text-primary-500"
                            >
                              {domain.domain_name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {domain.registrar || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {format(new Date(domain.expiry_date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <ClockIcon className="h-4 w-4 text-warning-500 mr-1" />
                            <span className="text-sm text-gray-900">{daysLeft} days</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(domain.domain_status)}`}>
                            {domain.domain_status?.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {expiringDomains.length > 5 && (
                <div className="px-6 py-3 bg-gray-50 text-right">
                  <Link
                    to="/domains"
                    className="text-sm font-medium text-primary-600 hover:text-primary-500"
                  >
                    View all domains →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard; 