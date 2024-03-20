import { useEffect, useRef, useState } from 'react';

import {
	ImageSegmenter,
	FilesetResolver,
	ImageSegmenterResult,
} from '@mediapipe/tasks-vision';
import './App.css';

function makeGaussKernel(sigma: number) {
	const GAUSSKERN = 6.0;
	const dim = parseInt(Math.max(3.0, GAUSSKERN * sigma));
	const sqrtSigmaPi2 = Math.sqrt(Math.PI * 2.0) * sigma;
	const s2 = 2.0 * sigma * sigma;
	let sum = 0.0;

	const kernel = new Float32Array(dim - !(dim & 1)); // Make it odd number
	const half = parseInt(kernel.length / 2);
	for (let j = 0, i = -half; j < kernel.length; i++, j++) {
		kernel[j] = Math.exp(-(i * i) / s2) / sqrtSigmaPi2;
		sum += kernel[j];
	}
	// Normalize the gaussian kernel to prevent image darkening/brightening
	for (let i = 0; i < dim; i++) {
		kernel[i] /= sum;
	}
	return kernel;
}

function blurPixels(
	pixels: Uint8ClampedArray,
	sigma: number,
	imageWidth: number,
	imageHeight: number
) {
	const kernel = makeGaussKernel(sigma);

	const w = imageWidth;
	const h = imageHeight;
	const buff = new Uint8Array(w * h);
	const mk = Math.floor(kernel.length / 2);
	const kl = kernel.length;

	for (let channel = 0; channel < 3; channel++) {
		// First step process columns
		for (let j = 0, hw = 0; j < h; j++, hw += w) {
			for (let i = 0; i < w; i++) {
				let sum = 0;
				for (let k = 0; k < kl; k++) {
					let col = i + (k - mk);
					col = col < 0 ? 0 : col >= w ? w - 1 : col;
					sum += pixels[(hw + col) * 4 + channel] * kernel[k];
				}
				buff[hw + i] = sum;
			}
		}

		// Second step process rows
		for (let j = 0, offset = 0; j < h; j++, offset += w) {
			for (let i = 0; i < w; i++) {
				let sum = 0;
				for (let k = 0; k < kl; k++) {
					let row = j + (k - mk);
					row = row < 0 ? 0 : row >= h ? h - 1 : row;
					sum += buff[row * w + i] * kernel[k];
				}
				const off = (j * w + i) * 4;
				pixels[off + channel] = sum;
			}
		}
	}
	return pixels;
}



function App() {
	const [blur, setBlur] = useState(false);
	const [webcamRunning, setWebcamRunning] = useState(false);
	const gco = useRef<GlobalCompositeOperation>('source-over');
	const gcoBackground = useRef<GlobalCompositeOperation>('source-over');
	const [filter, setFilter] = useState('none');
	const imageSegmenter = useRef<ImageSegmenter | undefined>(undefined);
	const refVideo = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLVideoElement>(null);
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
	const canvasEl = document.createElement('canvas');
	canvasEl.width = props.width;
	canvasEl.height = props.height;
	const ctx = canvasEl.getContext('2d');

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

	async function callbackForVideo(result: ImageSegmenterResult) {
		if (!ctx) return;
		if (refVideo.current === null) return;
		const imageHeight = refVideo.current?.videoHeight ?? props.height;
		const imageWidth = refVideo.current?.videoWidth ?? props.width;

		const originalImage = ctx.getImageData(
			0,
			0,
			imageWidth,
			imageHeight
		).data;
		const backgroundImageData = new Uint8ClampedArray(
			originalImage.slice(0).buffer
		);

		const blurredImage = blurPixels(
			backgroundImageData,
			5,
			imageWidth,
			imageHeight
		);

		// console.log(backgroundImageData.buffer);
		// console.log(result);
		const mask: Float32Array =
			result?.confidenceMasks?.[0].getAsFloat32Array();

		let j = 0;
		if (originalImage === undefined) return;
		for (let i = 0; i < mask.length; ++i) {
			const maskVal = Math.round(mask[i] * 255.0);

			//black mask
			// imageData[j] = mask[i] <= 0.5 ? imageData[j] : 50;
			// imageData[j + 1] = mask[i + 1] <= 0.5 ? imageData[j + 1] : 50;
			// imageData[j + 2] = mask[i + 2] <= 0.5 ? imageData[j + 2] : 50;

			//use the below line (alone) to just show the person outline in the video
			originalImage[j] =
				mask[i] <= 0.5 ? originalImage[j] : blurredImage[j];
			originalImage[j + 1] =
				mask[i + 1] <= 0.5 ? originalImage[j + 1] : blurredImage[j + 1];
			originalImage[j + 2] =
				mask[i + 2] <= 0.5 ? originalImage[j + 2] : blurredImage[j + 2];
			originalImage[j + 3] = 255;

			// imageData[j + 1] = (imageData[i + 1] * maskVal) / 255;
			// imageData[j + 2] = (imageData[i + 2] * maskVal) / 255;
			// imageData[j + 3] = 255;
			j += 4;
		}

		//ctx.globalCompositeOperation = gcoBackground.current;

		const uint8Array = new Uint8ClampedArray(originalImage.buffer);
		const dataNew = new ImageData(uint8Array, imageWidth, imageHeight);

		ctx.filter = 'none';
		ctx?.putImageData(dataNew, 0, 0);
		//ctx.globalCompositeOperation = gco.current;

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
		if (!ctx) return;
		if (refVideo.current?.currentTime === lastWebcamTime.current) {
			if (webcamRunning === true) {
				window.requestAnimationFrame(predictWebcam);
			}
			return;
		}

		lastWebcamTime.current = refVideo.current?.currentTime;
		ctx.drawImage(refVideo.current, 0, 0, props.width, props.height);
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
			await predictWebcam();
			canvasRef.current!.srcObject = canvasEl.captureStream(30);
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
