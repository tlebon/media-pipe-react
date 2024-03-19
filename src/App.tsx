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
	const gco = useRef<GlobalCompositeOperation>('source-over');
	const gcoBackground = useRef<GlobalCompositeOperation>('destination-out');
	const [filter, setFilter] = useState('none');
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
	const filterOptions = ['none', 'blur', 'grayscale', 'sepia', 'invert'];
	const gcoOptions = [
		'source-over',
		'source-in',
		'source-out',
		'source-atop',
		'destination-over',
		'destination-in',
		'destination-out',
		'destination-atop',
		'lighter',
		'copy',
		'xor',
		'multiply',
		'screen',
		'overlay',
		'darken',
		'lighten',
		'color-dodge',
		'color-burn',
		'hard-light',
		'soft-light',
		'difference',
		'exclusion',
		'hue',
		'saturation',
		'color',
		'luminosity',
	] as GlobalCompositeOperation[];

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

	async function callbackForVideo(result: ImageSegmenterResult) {
		if (!canvasCtx.current) return;
		if (refVideo.current === null) return;
		const imageData = canvasCtx.current.getImageData(
			0,
			0,
			refVideo.current?.videoWidth ?? props.width,
			refVideo.current?.videoHeight ?? props.height
		).data;
		const backgroundImageData = new Uint8ClampedArray(imageData.buffer);
		// console.log(result);
		const mask: Float32Array =
			result?.confidenceMasks?.[0].getAsFloat32Array();

		let j = 0;
		if (imageData === undefined) return;
		for (let i = 0; i < mask.length; ++i) {
			const maskVal = Math.round(mask[i] * 255.0);

			//black mask
			imageData[j] = mask[i] <= 0.5 ? imageData[j] : 50;
			imageData[j + 1] = mask[i + 1] <= 0.5 ? imageData[j + 1] : 50;
			imageData[j + 2] = mask[i + 2] <= 0.5 ? imageData[j + 2] : 50;

			//use the below line (alone) to just show the person outline in the video
			// imageData[j] = mask[i] <= 0.5 ? imageData[j] : 0;
			// imageData[j + 1] = mask[i + 1] <= 0.5 ? imageData[j + 1] : 0;
			// imageData[j + 2] = mask[i + 2] <= 0.5 ? imageData[j + 2] : 0;
			// imageData[j + 3] = mask[i] >= 0.5 ? 0 : 255;

			// imageData[j + 1] = (imageData[i + 1] * maskVal) / 255;
			// imageData[j + 2] = (imageData[i + 2] * maskVal) / 255;
			// imageData[j + 3] = 255;
			j += 4;
		}
		// const backgroundNew = new ImageData(
		// 	backgroundImageData,
		// 	refVideo.current?.videoWidth ?? props.width,
		// 	refVideo.current?.videoHeight ?? props.height
		// );
		// canvasCtx.current.filter = 'blur(5px)';
		// canvasCtx.current?.putImageData(backgroundNew, 0, 0);
		// canvasCtx.current.globalCompositeOperation = gcoBackground.current;

		const uint8Array = new Uint8ClampedArray(imageData.buffer);
		const dataNew = new ImageData(
			uint8Array,
			refVideo.current?.videoWidth ?? props.width,
			refVideo.current?.videoHeight ?? props.height
		);
		// const dataBitmap = await createImageBitmap(dataNew);

		canvasCtx.current.filter = 'none';
		canvasCtx.current?.putImageData(dataNew, 0, 0);
		canvasCtx.current.globalCompositeOperation = gco.current;

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
			outputCategoryMask: false,
			outputConfidenceMasks: true,
		});
	};
	// Get segmentation from the webcam
	const lastWebcamTime = useRef(-1);

	async function predictWebcam() {
		if (refVideo.current === null) return;
		if (!canvasCtx.current) return;
		if (refVideo.current?.currentTime === lastWebcamTime.current) {
			if (webcamRunning === true) {
				window.requestAnimationFrame(predictWebcam);
			}
			return;
		}

		lastWebcamTime.current = refVideo.current?.currentTime;
		canvasCtx.current.drawImage(
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
				<select
					value={gco.current}
					className="select"
					onChange={(e) =>
						(gco.current = e.target
							.value as GlobalCompositeOperation)
					}
				>
					{gcoOptions.map((val) => (
						<option key={val} value={val}>
							{val}
						</option>
					))}
				</select>
				<select
					value={gcoBackground.current}
					className="select"
					onChange={(e) =>
						(gcoBackground.current = e.target
							.value as GlobalCompositeOperation)
					}
				>
					{gcoOptions.map((val) => (
						<option key={val + 'back'} value={val}>
							{val}
						</option>
					))}
				</select>
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
