import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [responseMessage, setResponseMessage] = useState(null);
  const [fetchedData, setFetchedData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBackendData();
  }, [currentPage]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredData(fetchedData);
    } else {
      const filtered = fetchedData.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.contact.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredData(filtered);
    }
  }, [searchQuery, fetchedData]);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) {
      setErrorMessage('No file selected');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    const data = new FormData();
    data.append('file', file);

    try {
      const response = await axios.post('http://localhost:3000/submit', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.updated > 0) {
        setErrorMessage(`Some records were updated: ${response.data.updated}`);
      } else {
        setErrorMessage(null);
      }

      setResponseMessage(response.data);
      fetchBackendData();
    } catch (error) {
      console.error('Error submitting form data:', error);
      if (error.response && error.response.data && error.response.data.error) {
        setErrorMessage(error.response.data.error);
      } else {
        setErrorMessage('Failed to submit form data');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchBackendData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:3000/fetch', {
        params: {
          page: currentPage,
          limit: 10,
        },
      });
      setFetchedData(response.data.data);
      setFilteredData(response.data.data);
      setTotalPages(Math.ceil(response.data.total / 10));
    } catch (error) {
      console.error('Error fetching data:', error);
      setErrorMessage('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (page) => {
    setCurrentPage(page);
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  return (
    <div className="container mt-5">
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="file" className="form-label">File:</label>
          <input type="file" className="form-control" id="file" onChange={handleFileChange} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Uploading...' : 'Submit'}
        </button>
      </form>

      {errorMessage && (
        <div className="alert alert-danger mt-3">{errorMessage}</div>
      )}

      {responseMessage && (
        <div className="alert alert-success mt-3">
          <h3>Response from Server:</h3>
          <pre>{JSON.stringify(responseMessage, null, 2)}</pre>
        </div>
      )}

      <div className="mt-4">
        <input
          type="text"
          className="form-control"
          placeholder="Search..."
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>

      <div className="mt-4">
        <h3>Fetched Data from Backend:</h3>
        <ul className="list-group">
          {filteredData.map((item) => (
            <li key={item.id} className="list-group-item">
              {item.name} - {item.email} - {item.contact}
            </li>
          ))}
        </ul>
      </div>

      <nav className="mt-4">
        <ul className="pagination justify-content-center">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
              <button className="page-link" onClick={() => goToPage(page)}>{page}</button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default App;
