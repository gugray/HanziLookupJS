using System;
using System.Collections.Generic;

namespace MmahConvert
{
    public class Analyzer
    {
        // Magic constants used in decomposition of a stroke into substrokes
        const double MIN_SEGMENT_LENGTH = 12.5;
        const double MAX_LOCAL_LENGTH_RATIO = 1.1;
        const double MAX_RUNNING_LENGTH_RATIO = 1.09;

        // Bounding rectangle
        public int Top = int.MaxValue;
        public int Bottom = int.MinValue;
        public int Left = int.MaxValue;
        public int Right = int.MinValue;
        // Result of analysis
        public readonly List<SubStroke> AnalyzedStrokes = new List<SubStroke>();

        /// <summary>
        /// Analyzes strokes (coordinates need to be in 256x256 system)
        /// </summary>
        public Analyzer(List<Stroke> rawStrokes)
        {
            // Calculate bounding rectangle
            getBoundingRect(rawStrokes);
            // Build analyzed strokes
            buildAnalyzedStrokes(rawStrokes);
        }

        // Calculates rectangle that bounds all points in raw strokes.
        void getBoundingRect(List<Stroke> rawStrokes)
        {
            for (var i = 0; i != rawStrokes.Count; ++i)
            {
                for (var j = 0; j != rawStrokes[i].Points.Count; ++j)
                {
                    var pt = rawStrokes[i].Points[j];
                    if (pt.X < Left) Left = pt.X;
                    if (pt.X > Right) Right = pt.X;
                    if (pt.Y < Top) Top = pt.Y;
                    if (pt.Y > Bottom) Bottom = pt.Y;
                }
            }
        }

        // Gets distance between two points
        double dist(Point a, Point b)
        {
            double dx = a.X - b.X;
            double dy = a.Y - b.Y;
            return Math.Sqrt(dx * dx + dy * dy);
        }

        // Gets normalized distance between two points
        // Normalized based on bounding rectangle
        double normDist(Point a, Point b)
        {
            double width = Right - Left;
            double height = Bottom - Top;
            // normalizer is a diagonal along a square with sides of size the larger dimension of the bounding box
            double dimensionSquared = width > height ? width * width : height * height;
            double normalizer = Math.Sqrt(dimensionSquared + dimensionSquared);
            double distanceNormalized = dist(a, b) / normalizer;
            // Cap at 1 (...why is this needed??)
            return Math.Min(distanceNormalized, 1);
        }

        // Gets direction, in radians, from point a to b
        // 0 is to the right, PI / 2 is up, etc.
        double dir(Point a, Point b)
        {
            double dx = a.X - b.X;
            double dy = a.Y - b.Y;
            double dir = Math.Atan2(dy, dx);
            return Math.PI - dir;
        }

        // Calculates array with indexes of pivot points in raw stroke
        List<int> getPivotIndexes(List<Point> points)
        {
            // One item for each point: true if it's a pivot
            List<bool> markers = new List<bool>(points.Count);
            for (var i = 0; i != points.Count; ++i) markers.Add(false);

            // Cycle variables
            int prevPtIx = 0;
            int firstPtIx = 0;
            int pivotPtIx = 1;

            // The first point of a Stroke is always a pivot point.
            markers[0] = true;

            // localLength keeps track of the immediate distance between the latest three points.
            // We can use localLength to find an abrupt change in substrokes, such as at a corner.
            // We do this by checking localLength against the distance between the first and last
            // of the three points. If localLength is more than a certain amount longer than the
            // length between the first and last point, then there must have been a corner of some kind.
            double localLength = dist(points[firstPtIx], points[pivotPtIx]);

            // runningLength keeps track of the length between the start of the current SubStroke
            // and the point we are currently examining.  If the runningLength becomes a certain
            // amount longer than the straight distance between the first point and the current
            // point, then there is a new SubStroke.  This accounts for a more gradual change
            // from one SubStroke segment to another, such as at a longish curve.
            double runningLength = localLength;

            // Cycle through rest of stroke points.
            for (int i = 2; i < points.Count; ++i)
            {
                var nextPoint = points[i];

                // pivotPoint is the point we're currently examining to see if it's a pivot.
                // We get the distance between this point and the next point and add it
                // to the length sums we're using.
                var pivotLength = dist(points[pivotPtIx], nextPoint);
                localLength += pivotLength;
                runningLength += pivotLength;

                // Check the lengths against the ratios.  If the lengths are a certain among
                // longer than a straight line between the first and last point, then we
                // mark the point as a pivot.
                var distFromPrevious = dist(points[prevPtIx], nextPoint);
                var distFromFirst = dist(points[firstPtIx], nextPoint);
                if (localLength > MAX_LOCAL_LENGTH_RATIO * distFromPrevious ||
                    runningLength > MAX_RUNNING_LENGTH_RATIO * distFromFirst)
                {
                    // If the previous point was a pivot and was very close to this point,
                    // which we are about to mark as a pivot, then unmark the previous point as a pivot.
                    if (markers[prevPtIx] && dist(points[prevPtIx], points[pivotPtIx]) < MIN_SEGMENT_LENGTH)
                    {
                        markers[prevPtIx] = false;
                    }
                    markers[pivotPtIx] = true;
                    runningLength = pivotLength;
                    firstPtIx = pivotPtIx;
                }
                localLength = pivotLength;
                prevPtIx = pivotPtIx;
                pivotPtIx = i;
            }

            // last point (currently referenced by pivotPoint) has to be a pivot
            markers[pivotPtIx] = true;
            // Point before the final point may need to be handled specially.
            // Often mouse action will produce an unintended small segment at the end.
            // We'll want to unmark the previous point if it's also a pivot and very close to the lat point.
            // However if the previous point is the first point of the stroke, then don't unmark it, because
            // then we'd only have one pivot.
            if (markers[prevPtIx] && dist(points[prevPtIx], points[pivotPtIx]) < MIN_SEGMENT_LENGTH && prevPtIx != 0)
                markers[prevPtIx] = false;

            // Return result in the form of an index array: includes indexes where marker is true
            List<int> res = new List<int>();
            for (var i = 0; i != markers.Count; ++i)
                if (markers[i]) res.Add(i);
            return res;
        }

        // Builds array of substrokes from stroke's points, pivots, and character's bounding rectangle
        List<SubStroke> buildSubStrokes(List<Point> points, List<int> pivotIndexes)
        {
            List<SubStroke> res = new List<SubStroke>();
            var prevIx = 0;
            for (var i = 0; i != pivotIndexes.Count; ++i)
            {
                var ix = pivotIndexes[i];
                if (ix == prevIx) continue;
                var direction = dir(points[prevIx], points[ix]);
                var normLength = normDist(points[prevIx], points[ix]);
                Point ptCenter = new Point
                { 
                    X = (points[prevIx].X + points[ix].X) / 2,
                    Y = (points[prevIx].Y + points[ix].Y) / 2,
                };
                double centerX = normDist(new Point { X = 0, Y = ptCenter.Y }, ptCenter);
                double centerY = normDist(new Point { X = ptCenter.X, Y = 0 }, ptCenter);
                res.Add(new SubStroke { Dir = direction, Len = normLength, CenterX = centerX, CenterY = centerY });
                prevIx = ix;
            }
            return res;
        }

        // Analyze raw input, store result in AnalyzedStrokes member.
        void buildAnalyzedStrokes(List<Stroke> rawStrokes)
        {
            // Process each stroke
            for (var i = 0; i != rawStrokes.Count; ++i)
            {
                // Identify pivot points
                var pivotIndexes = getPivotIndexes(rawStrokes[i].Points);
                // Abstract away substrokes
                var subStrokes = buildSubStrokes(rawStrokes[i].Points, pivotIndexes);
                // Append
                AnalyzedStrokes.AddRange(subStrokes);
            }
        }

    }
}
