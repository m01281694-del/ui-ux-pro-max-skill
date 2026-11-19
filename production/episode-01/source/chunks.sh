#!/bin/bash
# usage: chunks.sh START END STEP  -> renders missing chunk files sequentially
cd /home/user/studio
for ((s=$1; s<$2; s+=$3)); do e=$((s+$3)); [ $e -gt $2 ] && e=$2; f=render/c_$(printf %05d $s)_$(printf %05d $e).mp4
  [ -f $f.ok ] && continue
  node render.js $s $e $f >> render/chunklog.txt 2>&1 && touch $f.ok
done
echo WORKER_DONE $1 $2 >> render/chunklog.txt
