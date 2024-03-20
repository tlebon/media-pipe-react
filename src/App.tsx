import { useRef, useState } from 'react';

import './App.css';
import { applyBlur } from './applyBlur';

function App() {
	const [blur, setBlur] = useState(false);
	const [webcamRunning, setWebcamRunning] = useState(false);

	const [filter, setFilter] = useState('none');
	const refVideo = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLVideoElement>(null);
	// const blurRef = useRef<MediaStream | undefined>(undefined);
	const props = {
		width: 640,
		height: 480,
		autoPlay: true,
		muted: true,
		playsInline: true,
	};
	const filterOptions = ['none', 'blur', 'grayscale', 'sepia', 'invert'];

	const handleWebcamToggle = async () => {
		if (hasGetUserMedia() && !webcamRunning) {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: true,
			});
			setWebcamRunning((webcamRunning) => !webcamRunning);
			refVideo.current!.srcObject = stream;
		} else if (webcamRunning) {
			setWebcamRunning((webcamRunning) => !webcamRunning);
			refVideo.current!.srcObject = null;
		} else {
			alert('getUserMedia() is not supported by your browser');
		}
	};

	// Check if webcam access is supported.
	function hasGetUserMedia() {
		return !!(
			navigator.mediaDevices && navigator.mediaDevices.getUserMedia
		);
	}

	const handleBlurClick = async (blur: boolean) => {
		if (!blur) {
			await applyBlur(refVideo.current!).then((stream) => {
				canvasRef.current!.srcObject = stream;
			});
		} else {
			canvasRef.current!.srcObject = null;
		}
		setBlur((blur) => !blur);
	};

	return (
		<>
			<div className="App">
				<h1>Vite + React</h1>
				<button onClick={handleWebcamToggle}>
					{!webcamRunning ? 'Start' : 'Stop'} webcam
				</button>
				<button onClick={() => handleBlurClick(blur)}>
					blur is {blur ? 'ON' : 'OFF'}
				</button>
				<select
					value={filter}
					className="select"
					onChange={(e) => setFilter(e.target.value)}
				>
					{filterOptions.map((val) => (
						<option value={val}>{val}</option>
					))}
				</select>
				<div className="card">
					<video
						ref={refVideo}
						{...props}
						// css={{
						// 	visibility: blur ? 'hidden' : 'visible',
						// 	display: blur ? 'none' : 'inline block',
						// }}
					/>
					<video
						ref={canvasRef}
						{...props}
						// css={{visibility: !!blur ? 'hidden' : 'visible', display: !!blur ? 'none' : 'inline block'}}
					/>

					{/* {!!blur && <video ref={video2ref} {...props} />} */}
				</div>
			</div>
		</>
	);
}

export default App;
