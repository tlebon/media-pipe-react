import { useEffect, useRef, useState } from 'react';

import {
	ImageSegmenter,
	FilesetResolver,
	ImageSegmenterResult,
} from '@mediapipe/tasks-vision';
import './App.css';

function App() {
	const [blur, setBlur] = useState(false);
	const [webcamRunning, setWebcamRunning] = useState(false);
	const imageSegmenter = useRef<ImageSegmenter | undefined>(undefined);
	const refVideo = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// const blurRef = useRef<MediaStream | undefined>(undefined);
	const canvasCtx = useRef<CanvasRenderingContext2D | null | undefined>(null);
	const rafId = useRef<number | null>(null);
	const props = {
		width: 640,
		height: 480,
		autoPlay: true,
		muted: true,
		playsInline: true,
	};

	const legendColors = [
		[50, 50, 50, 255],
		[0, 0, 255, 255],
		[0, 255, 0, 255],
		[0, 255, 255, 255],
		[255, 0, 0, 255],
		[255, 0, 255, 255],
		[255, 255, 0, 255],
		[255, 255, 255, 255],
	];

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

	useEffect(() => {
		if (canvasRef.current) {
			canvasCtx.current = canvasRef.current.getContext('2d');
		}
	}, []);

	function callbackForVideo(result: ImageSegmenterResult) {
		if (canvasCtx.current === null) return;
		if (refVideo.current === null) return;
		let imageData = canvasCtx.current?.getImageData(
			0,
			0,
			refVideo.current?.videoWidth ?? props.width,
			refVideo.current?.videoHeight ?? props.height
		).data;
		console.log(result);
		const mask: Float32Array = result?.categoryMask?.getAsFloat32Array();

		let j = 0;
		if (imageData === undefined) return;
		for (let i = 0; i < mask.length; ++i) {
			const maskVal = Math.round(mask[i] * 255.0);
			const legendColor = legendColors[maskVal % legendColors.length];
			imageData[j] = (legendColor[0] + imageData[j]) / 2;
			imageData[j + 1] = (legendColor[1] + imageData[j + 1]) / 2;
			imageData[j + 2] = (legendColor[2] + imageData[j + 2]) / 2;
			imageData[j + 3] = (legendColor[3] + imageData[j + 3]) / 2;
			j += 4;
		}
		if (imageData === undefined) return;
		const uint8Array = new Uint8ClampedArray(imageData.buffer);
		const dataNew = new ImageData(
			uint8Array,
			refVideo.current?.videoWidth ?? props.width,
			refVideo.current?.videoHeight ?? props.height
		);
		canvasCtx.current?.putImageData(dataNew, 0, 0);
		if (webcamRunning === true) {
			window.requestAnimationFrame(predictWebcam);
		}
	}

	const createImageSegmenter = async () => {
		const video = await FilesetResolver.forVisionTasks(
			'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm'
		);

		imageSegmenter.current = await ImageSegmenter.createFromOptions(video, {
			baseOptions: {
				modelAssetPath:
					'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
				delegate: 'GPU',
			},
			runningMode: 'VIDEO',
			outputCategoryMask: true,
			outputConfidenceMasks: false,
		});
	};
	// Get segmentation from the webcam
	const lastWebcamTime = useRef(-1);

	async function predictWebcam() {
		if (refVideo.current === null) return;
		if (refVideo.current?.currentTime === lastWebcamTime.current) {
			if (webcamRunning === true) {
				window.requestAnimationFrame(predictWebcam);
			}
			return;
		}

		lastWebcamTime.current = refVideo.current?.currentTime;
		canvasCtx.current?.drawImage(
			refVideo.current,
			0,
			0,
			refVideo.current.videoWidth,
			refVideo.current.videoHeight
		);
		// Do not segmented if imageSegmenter.current hasn't loaded
		if (imageSegmenter.current === undefined) {
			return;
		}
		const startTimeMs = performance.now();

		// Start segmenting the stream.
		imageSegmenter.current.segmentForVideo(
			refVideo.current,
			startTimeMs,
			callbackForVideo
		);
	}

	const handleBlurClick = async (blur: boolean) => {
		if (!blur) {
			await createImageSegmenter();
			predictWebcam();
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
				<div className="card">
					<video
						ref={refVideo}
						{...props}
						css={{
							visibility: blur ? 'hidden' : 'visible',
							display: blur ? 'none' : 'inline block',
						}}
					/>
					<canvas
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
