#!/bin/bash
set -e
cd /home/user/studio/render
ffmpeg -v error -y -i c_01680_01774.mp4 -vf "trim=start_frame=0:end_frame=90,setpts=PTS-STARTPTS" -c:v libx264 -crf 12 -preset fast -pix_fmt yuv420p -r 30 seg_a.mp4
ffmpeg -v error -y -i part2.mp4 -vf "trim=start_frame=498:end_frame=773,setpts=PTS-STARTPTS" -c:v libx264 -crf 12 -preset fast -pix_fmt yuv420p -r 30 seg_b.mp4
> list2.txt
for f in $(ls c_0*.mp4 | sort); do s=$((10#$(echo $f | cut -d_ -f2))); [ $s -lt 1680 ] && echo "file '$f'" >> list2.txt; done
echo "file 'seg_a.mp4'" >> list2.txt
for f in $(ls s6/c_*.mp4 | sort); do echo "file '$f'" >> list2.txt; done
echo "file 'seg_b.mp4'" >> list2.txt; echo "file 'c_02547_02663.mp4'" >> list2.txt
cd ..
ffmpeg -v error -y -f concat -safe 0 -i render/list2.txt -i audio/mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 18 -maxrate 7M -bufsize 14M -pix_fmt yuv420p -r 30 -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart out/episode01_9x16.mp4
ffmpeg -v error -y -i out/episode01_9x16.mp4 -filter_complex "[0:v]scale=1920:-2,crop=1920:1080,gblur=sigma=40,eq=brightness=-0.12[bg];[0:v]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0" -c:v libx264 -preset slow -crf 20 -maxrate 6M -bufsize 12M -c:a copy -movflags +faststart out/episode01_16x9.mp4
ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames:format=duration -of compact out/episode01_9x16.mp4
