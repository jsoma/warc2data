import React from 'react';
import './PageBrowser.css';

const PageBrowser = ({ pages, selectedPages, onPageToggle, onBatchPageToggle }) => {
  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return timestamp;
    }
  };

  const handleSelectAll = () => {
    if (selectedPages.length === pages.length) {
      // Deselect all
      onBatchPageToggle(pages, false);
    } else {
      // Select all
      onBatchPageToggle(pages, true);
    }
  };

  const allSelected = pages.length > 0 && selectedPages.length === pages.length;

  return (
    <div className="page-browser">
      <div className="page-browser-header">
        <h2>Web Pages {selectedPages.length > 0 && <span className="selected-count-badge">({selectedPages.length})</span>}</h2>
        <button 
          className={`select-all-pages-button ${allSelected ? 'all-selected' : ''}`}
          onClick={handleSelectAll}
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      
      {pages.length === 0 ? (
        <p className="empty-message">No pages found. Upload a WARC/WACZ file to begin.</p>
      ) : (
        <div className="page-list">
          {pages.map((page) => (
            <div 
              key={page.id} 
              className={`page-item ${selectedPages.some(p => p.id === page.id) ? 'selected' : ''}`}
              onClick={() => onPageToggle(page, !selectedPages.some(p => p.id === page.id))}
            >
              <div className="page-checkbox">
                <input
                  type="checkbox"
                  checked={selectedPages.some(p => p.id === page.id)}
                  onChange={(e) => onPageToggle(page, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="page-content">
                <div className="page-url" title={page.url}>
                  {page.url}
                </div>
                <div className="page-details">
                  {page.title && <span className="page-title">{page.title}</span>}
                  <span className="page-timestamp">{formatDate(page.timestamp)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PageBrowser; 