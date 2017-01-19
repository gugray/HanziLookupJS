var gulp = require('gulp');
var less = require('gulp-less');
var path = require('path');
var concat = require('gulp-concat');
var plumber = require('gulp-plumber');
var uglify = require('gulp-uglify');
var minifyCSS = require('gulp-minify-css');
var del = require('del');
var htmltojson = require('gulp-html-to-json');

// Compile all .less files to .css
gulp.task('less', function () {
  return gulp.src('./style/*.less')
    .pipe(plumber())
    .pipe(less({
      paths: [path.join(__dirname, 'less', 'includes')]
    }))
    .pipe(gulp.dest('./style/'));
});

// Minify and bundle JS files (library only, no sandbox scripts or data files)
gulp.task('scripts', function () {
  return gulp.src([
    './src/analyzedCharacter.js',
    './src/analyzedStroke.js',
    './src/characterMatch.js',
    './src/cubicCurve2D.js',
    './src/decodeCompact.js',
    './src/drawingBoard.js',
    './src/init.js',
    './src/matchCollector.js',
    './src/matcher.js',
    './src/strokeInputOverlay.js',
    './src/subStroke.js'
  ])
    .pipe(uglify().on('error', function (e) { console.log(e); }))
    .pipe(concat('hanzilookup.min.js'))
    .pipe(gulp.dest('../dist/'));
});

gulp.task('copydata', function() {
  return gulp.src(['./data/mmah.json', './data/orig.json']).pipe(gulp.dest('../dist/'));
});

// Delete all compiled and bundled files
gulp.task('clean', function () {
  return del(['./style/*.css']);
});

// Default task: full clean+build.
gulp.task('default', ['clean', 'less'], function () { });

// Publish task: bundle & minimize library; copy data script files
gulp.task('publish', ['scripts', 'copydata'], function() { });

// Watch: recompile less on changes
gulp.task('watch', function () {
  gulp.watch(['./style/*.less'], ['less']);
});
