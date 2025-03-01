import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import JsonBrowser from './components/JsonBrowser';
import JsonViewer from './components/JsonViewer';
import PathSelector from './components/PathSelector';
import CsvPreview from './components/CsvPreview';
import PageBrowser from './components/PageBrowser';
import './App.css';
import { processArchiveFiles, extractJsonContent, generateCsvPreview, exportToCsv } from './utils/archiveProcessor';

function App() {
  const [jsonFiles, setJsonFiles] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedJsonContent, setSelectedJsonContent] = useState(null);
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [jqPath, setJqPath] = useState('');
  const [suggestedPath, setSuggestedPath] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingStatus, setProcessingStatus] = useState('');
  const [pages, setPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [userDeselectedAll, setUserDeselectedAll] = useState(false);

  // Filter files when search term or selected pages change
  useEffect(() => {
    let filtered = [...jsonFiles];
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(file => 
        file.path.toLowerCase().includes(term) || 
        (file.pathname && file.pathname.toLowerCase().includes(term)) ||
        (file.hostname && file.hostname.toLowerCase().includes(term))
      );
    }
    
    // If no pages are selected, show no files
    if (selectedPages.length === 0 && pages.length > 0) {
      filtered = [];
    }
    // Filter by selected pages if there are any selected
    else if (selectedPages.length > 0) {
      // Get the URLs of selected pages
      const selectedPageUrls = selectedPages.map(page => page.url);
      
      // Filter files that belong to selected pages
      filtered = filtered.filter(file => 
        // Match by parentPageUrl if available
        (file.parentPageUrl && selectedPageUrls.includes(file.parentPageUrl)) ||
        // Or match by hostname if no parentPageUrl but page hostname matches
        (!file.parentPageUrl && file.page && selectedPages.some(page => page.hostname === file.page))
      );
    }
    
    setFilteredFiles(filtered);
  }, [jsonFiles, searchTerm, selectedPages, pages.length]);

  // Auto-select all pages when they're loaded, but respect when user manually deselects all
  useEffect(() => {
    if (pages.length > 0 && selectedPages.length === 0 && !userDeselectedAll) {
      setSelectedPages([...pages]);
    }
  }, [pages, selectedPages.length, userDeselectedAll]);

  // Analyze selected requests to suggest a JQ path
  useEffect(() => {
    if (selectedRequests.length === 0) {
      setSuggestedPath(null);
      return;
    }

    // Function to find arrays in JSON objects and their sizes
    const findArraysInObject = (obj, prefix = '', maxDepth = 2, currentDepth = 0) => {
      const arrays = [];
      
      if (!obj || typeof obj !== 'object' || currentDepth >= maxDepth) {
        return arrays;
      }
      
      // Process each key in the object
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        const path = prefix ? `${prefix}.${key}` : key;
        
        if (Array.isArray(value)) {
          arrays.push({
            path,
            length: value.length,
            items: value
          });
        } else if (typeof value === 'object' && value !== null) {
          // Recursively search nested objects
          const nestedArrays = findArraysInObject(value, path, maxDepth, currentDepth + 1);
          arrays.push(...nestedArrays);
        }
      });
      
      return arrays;
    };
    
    try {
      // Collect arrays from all selected requests
      const allArrays = [];
      
      selectedRequests.forEach(request => {
        if (request.content) {
          const content = typeof request.content === 'string' 
            ? JSON.parse(request.content) 
            : request.content;
          
          const arrays = findArraysInObject(content);
          allArrays.push(...arrays);
        }
      });
      
      // Group arrays by path and calculate total items
      const arraysByPath = {};
      allArrays.forEach(array => {
        if (!arraysByPath[array.path]) {
          arraysByPath[array.path] = {
            path: array.path,
            totalLength: 0,
            occurrences: 0,
            averageLength: 0,
            sample: array.items
          };
        }
        
        arraysByPath[array.path].totalLength += array.length;
        arraysByPath[array.path].occurrences += 1;
      });
      
      // Calculate average length for each path
      Object.values(arraysByPath).forEach(info => {
        info.averageLength = info.totalLength / info.occurrences;
      });
      
      // Sort by average length and occurrences
      const sortedArrays = Object.values(arraysByPath).sort((a, b) => {
        // Prioritize arrays that appear in more requests
        if (a.occurrences !== b.occurrences) {
          return b.occurrences - a.occurrences;
        }
        // Then prioritize by average length
        return b.averageLength - a.averageLength;
      });
      
      // Get the best suggestion
      if (sortedArrays.length > 0) {
        const bestSuggestion = sortedArrays[0];
        setSuggestedPath({
          path: bestSuggestion.path,
          description: `Found in ${bestSuggestion.occurrences} request${bestSuggestion.occurrences > 1 ? 's' : ''} with avg. ${Math.round(bestSuggestion.averageLength)} items`,
          sample: bestSuggestion.sample.slice(0, 3) // Include a sample of up to 3 items
        });
      } else {
        setSuggestedPath(null);
      }
    } catch (err) {
      console.error("Error analyzing JSON for path suggestions:", err);
      setSuggestedPath(null);
    }
  }, [selectedRequests]);

  const dropzoneOptions = {
    onDrop: async (acceptedFiles) => {
      // Reset states
      setIsLoading(true);
      setError(null);
      setSearchTerm('');
      setProcessingStatus('Starting to process files...');
      setSelectedPages([]);
      setUserDeselectedAll(false);
      
      try {
        console.log("Processing files:", acceptedFiles.map(f => f.name));
        // Process WARC/WACZ files and extract JSON content
        setProcessingStatus('Extracting API requests from archive files...');
        const { jsonFiles: extractedJsonFiles, pages: extractedPages } = await processArchiveFiles(acceptedFiles);
        console.log(`Found ${extractedJsonFiles.length} JSON files and ${extractedPages.length} pages`);
        setJsonFiles(extractedJsonFiles);
        setPages(extractedPages);
        // Auto-select all pages
        setSelectedPages(extractedPages);
        setProcessingStatus(`Found ${extractedJsonFiles.length} API requests from ${extractedPages.length} pages`);
      } catch (err) {
        console.error("Error processing files:", err);
        setError(`Error processing files: ${err.message}`);
        setJsonFiles([]);
        setPages([]);
        setProcessingStatus('');
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions);

  const handleFileSelect = async (file) => {
    setSelectedFile(file);
    const content = await extractJsonContent(file);
    setSelectedJsonContent(content);
  };

  const handleRequestToggle = (file, isSelected) => {
    let newSelectedRequests;
    
    if (isSelected) {
      newSelectedRequests = [...selectedRequests, file];
      setSelectedRequests(newSelectedRequests);
      updateCsvPreviewWithData(newSelectedRequests, jqPath);
      
      // If this is the first selected request or there were no previously selected requests,
      // automatically display its JSON content
      if (newSelectedRequests.length === 1) {
        handleFileSelect(file);
      }
    } else {
      newSelectedRequests = selectedRequests.filter(req => req.id !== file.id);
      setSelectedRequests(newSelectedRequests);
      updateCsvPreviewWithData(newSelectedRequests, jqPath);
      
      // If we just removed the currently displayed file, show the first one in the remaining selection
      if (selectedFile && selectedFile.id === file.id && newSelectedRequests.length > 0) {
        handleFileSelect(newSelectedRequests[0]);
      } else if (newSelectedRequests.length === 0) {
        // If no requests are selected, clear the JSON content
        setSelectedJsonContent(null);
        setSelectedFile(null);
      }
    }
  };

  // Batch update selected requests (for multi-select operations)
  const handleBatchRequestToggle = (filesToToggle, isSelected) => {
    let newSelectedRequests;
    
    if (isSelected) {
      // Add files that aren't already selected
      const filesToAdd = filesToToggle.filter(file => 
        !selectedRequests.some(req => req.id === file.id)
      );
      newSelectedRequests = [...selectedRequests, ...filesToAdd];
      
      // If there were no previously selected requests and we're adding some,
      // automatically display the first one's JSON content
      if (selectedRequests.length === 0 && newSelectedRequests.length > 0) {
        handleFileSelect(newSelectedRequests[0]);
      }
    } else {
      // Remove files that are being deselected
      const fileIdsToRemove = filesToToggle.map(file => file.id);
      newSelectedRequests = selectedRequests.filter(req => 
        !fileIdsToRemove.includes(req.id)
      );
      
      // If we just removed the currently displayed file, show the first one in the remaining selection
      if (selectedFile && fileIdsToRemove.includes(selectedFile.id)) {
        if (newSelectedRequests.length > 0) {
          handleFileSelect(newSelectedRequests[0]);
        } else {
          // If no requests are selected, clear the JSON content
          setSelectedJsonContent(null);
          setSelectedFile(null);
        }
      }
    }
    
    setSelectedRequests(newSelectedRequests);
    updateCsvPreviewWithData(newSelectedRequests, jqPath);
  };

  const handlePathSelect = (path) => {
    setJqPath(path);
    try {
      updateCsvPreviewWithData(selectedRequests, path);
    } catch (err) {
      console.error("Error updating CSV preview:", err);
      setCsvPreview([]);
    }
  };

  const handleSuggestedPathSelect = () => {
    if (suggestedPath) {
      handlePathSelect(suggestedPath.path);
    }
  };

  const updateCsvPreviewWithData = (requests, path) => {
    if (!path) {
      setCsvPreview([]);
      return;
    }
    
    if (requests.length > 0) {
      try {
        const previewData = generateCsvPreview(requests, path);
        setCsvPreview(previewData);
      } catch (err) {
        console.error("Error generating CSV preview:", err);
        setCsvPreview([]);
      }
    } else {
      setCsvPreview([]);
    }
  };

  const updateCsvPreview = () => {
    try {
      updateCsvPreviewWithData(selectedRequests, jqPath);
    } catch (err) {
      console.error("Error updating CSV preview:", err);
      setCsvPreview([]);
    }
  };

  const handleExport = () => {
    if (csvPreview.length > 0) {
      exportToCsv(csvPreview);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
  };

  const handlePageToggle = (page, isSelected) => {
    if (isSelected) {
      setSelectedPages([...selectedPages, page]);
      setUserDeselectedAll(false);
    } else {
      const newSelectedPages = selectedPages.filter(p => p.id !== page.id);
      setSelectedPages(newSelectedPages);
      
      // If this was the last selected page, set the flag
      if (newSelectedPages.length === 0 && selectedPages.length === 1) {
        setUserDeselectedAll(true);
      }
    }
  };

  const handleBatchPageToggle = (pagesToToggle, isSelected) => {
    if (isSelected) {
      // Add pages that aren't already selected
      const pagesToAdd = pagesToToggle.filter(page => 
        !selectedPages.some(p => p.id === page.id)
      );
      setSelectedPages([...selectedPages, ...pagesToAdd]);
      setUserDeselectedAll(false);
    } else {
      // Remove pages that are being deselected
      const pageIdsToRemove = pagesToToggle.map(page => page.id);
      const newSelectedPages = selectedPages.filter(p => 
        !pageIdsToRemove.includes(p.id)
      );
      setSelectedPages(newSelectedPages);
      
      // If all pages are being deselected, set the flag
      if (pagesToToggle.length === pages.length && newSelectedPages.length === 0) {
        setUserDeselectedAll(true);
      }
    }
  };

  return (
    <div className="app-container">
      <h1>Web Archive JSON Extractor</h1>
      
      <div className="app-description">
        <p>
          Extract and analyze API requests from web archives (WARC/WACZ files). 
          This tool finds JSON API requests made by web pages and allows you to explore and export the data.
        </p>
      </div>
      
      <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''} ${isLoading ? 'loading' : ''}`}>
        <input {...getInputProps()} />
        {isLoading ? (
          <p>{processingStatus || 'Processing files, please wait...'}</p>
        ) : isDragActive ? (
          <p>Drop the WARC/WACZ files here...</p>
        ) : (
          <div>
            <p>Drag and drop WARC/WACZ files here, or click to select files</p>
            <p className="dropzone-hint">
              The tool will extract API requests (JSON responses) from the archive files, 
              including those made by JavaScript fetch/XHR calls.
            </p>
          </div>
        )}
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="main-content">
        {pages.length > 0 && (
          <PageBrowser 
            pages={pages}
            selectedPages={selectedPages}
            onPageToggle={handlePageToggle}
            onBatchPageToggle={handleBatchPageToggle}
          />
        )}
        
        <div className="top-section">
          <div className="left-panel">
            <JsonBrowser 
              jsonFiles={filteredFiles} 
              onFileSelect={handleFileSelect}
              onRequestToggle={handleRequestToggle}
              onBatchRequestToggle={handleBatchRequestToggle}
              selectedRequests={selectedRequests}
              searchTerm={searchTerm}
              onSearchChange={handleSearchChange}
              onClearFilters={handleClearFilters}
            />
          </div>
          
          <div className="right-panel">
            <JsonViewer 
              jsonContent={selectedJsonContent} 
              onPathSelect={handlePathSelect} 
            />
            
            <div className="extraction-section">
              <PathSelector 
                path={jqPath} 
                onPathChange={handlePathSelect}
                selectedRequests={selectedRequests}
                suggestedPath={suggestedPath}
                onSuggestedPathSelect={handleSuggestedPathSelect}
              />
            </div>
          </div>
        </div>
        
        <div className="bottom-section">
          <CsvPreview 
            data={csvPreview} 
            onExport={handleExport} 
          />
        </div>
      </div>
    </div>
  );
}

export default App; 