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

// Delete all compiled and bundled files
gulp.task('clean', function () {
  return del(['./style/*.css']);
});

// Default task: full clean+build.
gulp.task('default', ['clean', 'less'], function () { });

// Watch: recompile less on changes
gulp.task('watch', function () {
  gulp.watch(['./style/*.less'], ['less']);
});
