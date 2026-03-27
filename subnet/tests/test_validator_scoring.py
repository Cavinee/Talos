import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_compute_f1_all_correct():
    from validator import compute_f1
    blue_classifications = ["dangerous", "dangerous", "safe"]
    judge_verdicts = [True, True, False]
    precision, recall, f1 = compute_f1(blue_classifications, judge_verdicts)
    assert f1 == 1.0


def test_compute_f1_all_wrong():
    from validator import compute_f1
    blue_classifications = ["safe", "safe", "safe"]
    judge_verdicts = [True, True, True]
    precision, recall, f1 = compute_f1(blue_classifications, judge_verdicts)
    assert recall == 0.0


def test_compute_f1_mixed():
    from validator import compute_f1
    blue_classifications = ["dangerous", "dangerous", "safe"]
    judge_verdicts = [True, False, True]
    precision, recall, f1 = compute_f1(blue_classifications, judge_verdicts)
    assert precision == 0.5
    assert recall == 0.5


def test_compute_f1_no_positives():
    from validator import compute_f1
    blue_classifications = ["safe", "safe"]
    judge_verdicts = [False, False]
    precision, recall, f1 = compute_f1(blue_classifications, judge_verdicts)
    assert f1 == 1.0
