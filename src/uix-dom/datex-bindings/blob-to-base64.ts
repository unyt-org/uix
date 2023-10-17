/**
 * Maps local "blob:" URL to
 * to exportable base64 URL
 */
export async function blobToBase64(blobUri:string|URL) {
	const blob = await fetch(blobUri).then(r => r.blob());
	return new Promise<string>((resolve, _) => {
	  const reader = new FileReader();
	  reader.onloadend = () => resolve(reader.result as string);
	  reader.readAsDataURL(blob);
	});
}