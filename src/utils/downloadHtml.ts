/**
 * Utility to download the standalone single-file index.html directly from browser
 */
export async function downloadStandaloneHtml(): Promise<void> {
  try {
    const res = await fetch('/standalone.html');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'index.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.warn('Could not fetch /standalone.html, opening in new window:', error);
    window.open('/standalone.html', '_blank');
  }
}
