document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const htmlContentTextarea = document.getElementById('html-content');
    const arcUrlInput = document.getElementById('arc-url');
    const parseHtmlButton = document.getElementById('parse-html');
    const fetchUrlButton = document.getElementById('fetch-url');
    const downloadButton = document.getElementById('download-button');
    const bookmarkCountSpan = document.getElementById('bookmark-count');
    const statusDiv = document.getElementById('status');
    const urlStatusDiv = document.getElementById('url-status');
    
    // Tab functionality
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabContentId = tab.getAttribute('data-tab');
            document.getElementById(tabContentId).classList.add('active');
        });
    });

    // Handle paste events on the URL input
    arcUrlInput.addEventListener('paste', function(e) {
        // Give it a moment to update the input value after paste
        setTimeout(() => {
            // Clean up the pasted URL (remove @ prefix if present)
            const pastedContent = arcUrlInput.value.trim();
            if (pastedContent.startsWith('@https://arc.net/')) {
                arcUrlInput.value = pastedContent.substring(1);
            }
        }, 0);
    });
    
    // Process HTML content
    parseHtmlButton.addEventListener('click', function() {
        const htmlContent = htmlContentTextarea.value.trim();
        if (!htmlContent) {
            showStatus('Please paste HTML content from an Arc sharing page', 'error');
            return;
        }
        
        processHtmlContent(htmlContent);
    });
    
    // Fetch URL and process its content
    fetchUrlButton.addEventListener('click', function() {
        let arcUrl = arcUrlInput.value.trim();
        
        // Remove @ prefix if present (common when copying Arc links)
        if (arcUrl.startsWith('@')) {
            arcUrl = arcUrl.substring(1);
        }
        
        if (!arcUrl) {
            showUrlStatus('Please enter a valid Arc sharing URL', 'error');
            return;
        }
        
        if (!arcUrl.startsWith('https://arc.net/')) {
            showUrlStatus('URL must be from arc.net', 'error');
            return;
        }
        
        showUrlStatus('Fetching content...', '');
        
        // Use CORS proxy to fetch content
        fetchContentWithProxy(arcUrl)
            .then(htmlContent => {
                if (htmlContent) {
                    processHtmlContent(htmlContent);
                    showUrlStatus('Content fetched successfully', 'success');
                } else {
                    showUrlStatus('Failed to fetch content. Please try the "Paste HTML" tab instead.', 'error');
                }
            })
            .catch(error => {
                console.error('Fetch error:', error);
                showUrlStatus(`Error fetching content: ${error.message}. Please try the "Paste HTML" tab instead.`, 'error');
            });
    });
    
    // Download the bookmarks file
    downloadButton.addEventListener('click', function() {
        const bookmarksHtml = downloadButton.getAttribute('data-bookmarks');
        if (!bookmarksHtml) {
            showStatus('No bookmarks available to download', 'error');
            return;
        }
        
        // Create a blob and download
        const blob = new Blob([bookmarksHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'arc_bookmarks.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showStatus('Bookmarks downloaded successfully', 'success');
    });
    
    // Helper function to fetch content from URL using public CORS proxies
    async function fetchContentWithProxy(url) {
        // List of public CORS proxies to try
        const corsProxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
            `https://corsproxy.io/?${encodeURIComponent(url)}`,
            `https://cors-anywhere.herokuapp.com/${url}`
        ];
        
        // Try each proxy until one works
        for (const proxyUrl of corsProxies) {
            try {
                showUrlStatus(`Trying to fetch via proxy...`, '');
                const response = await fetch(proxyUrl);
                if (response.ok) {
                    return await response.text();
                }
            } catch (error) {
                console.error(`Error with proxy ${proxyUrl}:`, error);
                // Continue to next proxy
            }
        }
        
        // If all proxies fail, try direct fetch as a last resort
        try {
            showUrlStatus(`Trying direct fetch...`, '');
            const response = await fetch(url);
            return await response.text();
        } catch (error) {
            console.error('Direct fetch error:', error);
            showUrlStatus('All fetch methods failed. Please use the "Paste HTML" tab instead.', 'error');
            return null;
        }
    }
    
    // Process the HTML content to extract bookmarks
    function processHtmlContent(htmlContent) {
        try {
            // Parse the HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            
            // Try to find the JSON data
            const scriptTags = doc.querySelectorAll('script');
            let bookmarksData = null;
            
            for (const script of scriptTags) {
                if (script.id === '__NEXT_DATA__') {
                    try {
                        const jsonData = JSON.parse(script.textContent);
                        if (jsonData.props?.pageProps?.data?.items) {
                            bookmarksData = {
                                items: jsonData.props.pageProps.data.items,
                                rootItems: jsonData.props.pageProps.data.rootItems
                            };
                            break;
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }
            }
            
            if (!bookmarksData) {
                showStatus('Failed to extract bookmark data from HTML content', 'error');
                return;
            }
            
            // Convert bookmarks to standard format
            const bookmarksHtml = convertToStandardFormat(bookmarksData);
            
            // Count bookmarks
            const bookmarkCount = countBookmarks(bookmarksData);
            bookmarkCountSpan.textContent = bookmarkCount;
            
            // Store the HTML for download
            downloadButton.setAttribute('data-bookmarks', bookmarksHtml);
            downloadButton.disabled = false;
            
            showStatus('Bookmarks extracted successfully', 'success');
        } catch (error) {
            console.error('Error processing HTML:', error);
            showStatus(`Error: ${error.message}`, 'error');
        }
    }
    
    // Count the number of bookmarks
    function countBookmarks(data) {
        // Count items that have URLs (tabs)
        return data.items.filter(item => item.data?.tab?.savedURL).length;
    }
    
    // Convert Arc bookmark data to standard HTML bookmark format
    function convertToStandardFormat(data) {
        const { items, rootItems } = data;
        
        // Create a map of items by ID for quick lookup
        const itemsMap = {};
        items.forEach(item => {
            itemsMap[item.id] = item;
        });
        
        // Start building the HTML
        let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks from Arc Browser</TITLE>
<H1>Bookmarks from Arc Browser</H1>
<DL><p>
`;

        // Function to recursively build the bookmark structure
        function processItem(itemId, indent = 4) {
            const item = itemsMap[itemId];
            if (!item) return '';
            
            const spaces = ' '.repeat(indent);
            let itemHtml = '';
            
            // If it's a folder (has children)
            if (item.childrenIds && item.childrenIds.length > 0) {
                const folderName = item.title || 'Untitled Folder';
                const addDate = Math.floor(item.createdAt || Date.now() / 1000);
                
                itemHtml += `${spaces}<DT><H3 ADD_DATE="${addDate}" LAST_MODIFIED="${addDate}">${folderName}</H3>\n`;
                itemHtml += `${spaces}<DL><p>\n`;
                
                // Process children
                for (const childId of item.childrenIds) {
                    itemHtml += processItem(childId, indent + 4);
                }
                
                itemHtml += `${spaces}</DL><p>\n`;
            } 
            // If it's a bookmark/link
            else if (item.data?.tab?.savedURL) {
                const url = item.data.tab.savedURL;
                const title = item.title || item.data.tab.savedTitle || url;
                const addDate = Math.floor(item.createdAt || Date.now() / 1000);
                
                itemHtml += `${spaces}<DT><A HREF="${url}" ADD_DATE="${addDate}">${title}</A>\n`;
            }
            
            return itemHtml;
        }
        
        // Process all root items
        for (const rootItemId of rootItems) {
            html += processItem(rootItemId);
        }
        
        // Close the main DL tag
        html += '</DL><p>\n';
        
        return html;
    }
    
    // Display status messages
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = 'status';
        if (type) {
            statusDiv.classList.add(type);
        }
    }
    
    // Display URL fetching status
    function showUrlStatus(message, type) {
        urlStatusDiv.textContent = message;
        urlStatusDiv.className = 'status';
        if (type) {
            urlStatusDiv.classList.add(type);
        }
    }
    
    // Check for URL in clipboard and offer to paste it
    navigator.clipboard.readText()
        .then(clipText => {
            // If clipboard text is an Arc URL
            const isArcUrl = clipText.includes('arc.net/folder/') || 
                             (clipText.startsWith('@') && clipText.includes('arc.net/folder/'));
            
            if (isArcUrl) {
                // Switch to URL tab
                document.querySelector('.tab[data-tab="url-input"]').click();
                
                // Add a suggestion to paste the URL
                const suggestion = document.createElement('div');
                suggestion.classList.add('clipboard-suggestion');
                suggestion.innerHTML = `
                    <p>Arc URL detected in clipboard. <button id="paste-clipboard">Paste & Convert</button></p>
                `;
                
                // Insert after the input
                arcUrlInput.parentNode.insertBefore(suggestion, arcUrlInput.nextSibling);
                
                // Add click handler to the paste button
                document.getElementById('paste-clipboard').addEventListener('click', function() {
                    // Clean up the URL if needed
                    let url = clipText;
                    if (url.startsWith('@')) {
                        url = url.substring(1);
                    }
                    
                    arcUrlInput.value = url;
                    fetchUrlButton.click();
                    
                    // Remove the suggestion
                    suggestion.remove();
                });
            }
        })
        .catch(err => {
            // If clipboard access is denied, just continue silently
            console.log('Clipboard access denied or empty');
        });
}); 