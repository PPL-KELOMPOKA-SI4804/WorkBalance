<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Employee;
use App\Models\SurveyResponse;
use App\Models\UserAccount;
use App\Models\WorkSurvey;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class SurveyService
{
    /**
     * Retrieve surveys with strictly aggregated department metrics (NFR-02 privacy).
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function list(array $filters, UserAccount $actor): array
    {
        $query = WorkSurvey::query()->withCount('responses');

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('period_month', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['period_month'])) {
            $query->where('period_month', trim((string) $filters['period_month']));
        }

        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $val = strtolower((string) $filters['is_active']);
            if (in_array($val, ['1', 'true', 'active'], true)) {
                $query->where('is_active', true);
            } elseif (in_array($val, ['0', 'false', 'inactive'], true)) {
                $query->where('is_active', false);
            }
        }

        $surveys = $query
            ->orderByDesc('period_month')
            ->orderByDesc('id')
            ->get();

        $departments = Department::query()
            ->withCount(['employees as active_employees_count' => fn ($q) => $q->where('status', 'active')])
            ->orderBy('name')
            ->get();

        $activeEmployeesCount = Employee::where('status', 'active')->count();
        $myResponsesBySurveyId = $this->loadOwnResponsesMap($actor);

        $formattedSurveys = $surveys
            ->map(fn (WorkSurvey $survey) => $this->formatSurvey(
                $survey,
                $actor,
                $departments,
                $activeEmployeesCount,
                $myResponsesBySurveyId
            ))
            ->values();

        $totalSurveys = WorkSurvey::count();
        $activeSurveysCount = WorkSurvey::where('is_active', true)->count();
        $overallStats = SurveyResponse::query()
            ->selectRaw('COUNT(*) as total_responses, AVG(work_life_balance_score) as avg_wlb, AVG(workload_perception_score) as avg_workload')
            ->first();

        $totalResponses = (int) ($overallStats->total_responses ?? 0);
        $overallAvgWlb = $totalResponses > 0 ? round((float) $overallStats->avg_wlb, 2) : null;
        $overallAvgWorkload = $totalResponses > 0 ? round((float) $overallStats->avg_workload, 2) : null;
        $overallWlbDim = $overallAvgWlb !== null ? round((($overallAvgWlb - 1) / 4) * 100, 2) : null;
        $overallParticipationRate = ($totalSurveys > 0 && $activeEmployeesCount > 0)
            ? round(($totalResponses / ($totalSurveys * $activeEmployeesCount)) * 100, 1)
            : 0.0;

        $summary = [
            'total_surveys' => $totalSurveys,
            'active_surveys_count' => $activeSurveysCount,
            'total_responses' => $totalResponses,
            'overall_avg_wlb' => $overallAvgWlb,
            'overall_avg_workload_perception' => $overallAvgWorkload,
            'overall_wlb_dimension_score' => $overallWlbDim,
            'overall_participation_rate' => $overallParticipationRate,
        ];

        if ($actor->role === 'employee') {
            $employeeId = $actor->employee?->id ?? 0;
            $submittedIds = SurveyResponse::where('employee_id', $employeeId)
                ->pluck('work_survey_id')
                ->all();

            $myPendingCount = WorkSurvey::where('is_active', true)
                ->when($submittedIds !== [], fn ($q) => $q->whereNotIn('id', $submittedIds))
                ->count();

            $myAvgWlbRaw = SurveyResponse::where('employee_id', $employeeId)
                ->avg('work_life_balance_score');

            $summary['my_submitted_count'] = count($submittedIds);
            $summary['my_pending_count'] = $myPendingCount;
            $summary['my_avg_wlb'] = $myAvgWlbRaw !== null ? round((float) $myAvgWlbRaw, 2) : null;
        }

        return [
            'surveys' => $formattedSurveys,
            'summary' => $summary,
        ];
    }

    /**
     * Load a single survey with aggregated department breakdown (NFR-02).
     *
     * @return array<string, mixed>
     */
    public function find(WorkSurvey $survey, UserAccount $actor): array
    {
        $departments = Department::query()
            ->withCount(['employees as active_employees_count' => fn ($q) => $q->where('status', 'active')])
            ->orderBy('name')
            ->get();

        $activeEmployeesCount = Employee::where('status', 'active')->count();
        $myResponsesBySurveyId = $this->loadOwnResponsesMap($actor);

        return $this->formatSurvey(
            $survey,
            $actor,
            $departments,
            $activeEmployeesCount,
            $myResponsesBySurveyId
        );
    }

    /**
     * Create a new work survey period inside a transaction.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function createSurvey(array $data, UserAccount $actor): array
    {
        $title = trim((string) $data['title']);
        $periodMonth = trim((string) $data['period_month']);

        if (WorkSurvey::where('title', $title)->where('period_month', $periodMonth)->exists()) {
            throw new ConflictHttpException('Survei dengan judul yang sama sudah terdaftar pada periode ini.');
        }

        $survey = DB::transaction(function () use ($data, $title, $periodMonth) {
            $description = isset($data['description']) ? trim((string) $data['description']) : null;

            return WorkSurvey::create([
                'title' => $title,
                'period_month' => $periodMonth,
                'description' => $description === '' ? null : $description,
                'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true,
            ]);
        });

        return $this->find($survey, $actor);
    }

    /**
     * Update an existing work survey questionnaire inside a transaction.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function updateSurvey(WorkSurvey $survey, array $data, UserAccount $actor): array
    {
        $targetTitle = array_key_exists('title', $data) ? trim((string) $data['title']) : $survey->title;
        $targetPeriod = array_key_exists('period_month', $data) ? trim((string) $data['period_month']) : $survey->period_month;

        $duplicateExists = WorkSurvey::where('title', $targetTitle)
            ->where('period_month', $targetPeriod)
            ->where('id', '!=', $survey->id)
            ->exists();

        if ($duplicateExists) {
            throw new ConflictHttpException('Survei dengan judul yang sama sudah terdaftar pada periode ini.');
        }

        DB::transaction(function () use ($survey, $data) {
            $fields = [];

            if (array_key_exists('title', $data)) {
                $fields['title'] = trim((string) $data['title']);
            }

            if (array_key_exists('period_month', $data)) {
                $fields['period_month'] = trim((string) $data['period_month']);
            }

            if (array_key_exists('description', $data)) {
                $description = $data['description'] !== null ? trim((string) $data['description']) : null;
                $fields['description'] = $description === '' ? null : $description;
            }

            if (array_key_exists('is_active', $data)) {
                $fields['is_active'] = (bool) $data['is_active'];
            }

            if ($fields !== []) {
                $survey->update($fields);
            }
        });

        return $this->find($survey->fresh(), $actor);
    }

    /**
     * Delete a work survey unless responses already exist.
     */
    public function deleteSurvey(WorkSurvey $survey): void
    {
        if ($survey->responses()->exists()) {
            throw new ConflictHttpException('Survei tidak dapat dihapus karena sudah memiliki respons dari pegawai.');
        }

        DB::transaction(function () use ($survey) {
            $survey->delete();
        });
    }

    /**
     * Submit an employee response for an active survey.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function submitResponse(WorkSurvey $survey, array $data, UserAccount $actor): array
    {
        $employee = $actor->employee;

        if (! $employee || $employee->status !== 'active') {
            throw new ConflictHttpException('Hanya pegawai aktif yang terhubung dengan profil pegawai yang dapat mengisi survei.');
        }

        if (! $survey->is_active) {
            throw new ConflictHttpException('Periode pengisian survei ini sudah ditutup.');
        }

        if (SurveyResponse::where('work_survey_id', $survey->id)->where('employee_id', $employee->id)->exists()) {
            throw new ConflictHttpException('Anda sudah mengirimkan respons untuk survei ini.');
        }

        $response = DB::transaction(function () use ($survey, $data, $employee) {
            $comments = isset($data['comments']) ? trim((string) $data['comments']) : null;

            return SurveyResponse::create([
                'work_survey_id' => $survey->id,
                'employee_id' => $employee->id,
                'work_life_balance_score' => (int) $data['work_life_balance_score'],
                'workload_perception_score' => (int) $data['workload_perception_score'],
                'comments' => $comments === '' ? null : $comments,
                'submitted_at' => now(),
            ]);
        });

        return [
            'id' => $response->id,
            'work_survey_id' => $response->work_survey_id,
            'work_life_balance_score' => $response->work_life_balance_score,
            'workload_perception_score' => $response->workload_perception_score,
            'comments' => $response->comments,
            'submitted_at' => $response->submitted_at?->toIso8601String(),
        ];
    }

    /**
     * Update an employee's own survey response while the survey remains active.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function updateResponse(WorkSurvey $survey, array $data, UserAccount $actor): array
    {
        $employee = $actor->employee;

        if (! $employee || $employee->status !== 'active') {
            throw new ConflictHttpException('Hanya pegawai aktif yang dapat memperbarui respons survei.');
        }

        if (! $survey->is_active) {
            throw new ConflictHttpException('Periode pengisian survei ini sudah ditutup sehingga respons tidak dapat diubah.');
        }

        $response = SurveyResponse::where('work_survey_id', $survey->id)
            ->where('employee_id', $employee->id)
            ->firstOrFail();

        DB::transaction(function () use ($response, $data) {
            $comments = array_key_exists('comments', $data) && $data['comments'] !== null
                ? trim((string) $data['comments'])
                : null;

            $response->update([
                'work_life_balance_score' => (int) $data['work_life_balance_score'],
                'workload_perception_score' => (int) $data['workload_perception_score'],
                'comments' => $comments === '' ? null : $comments,
                'submitted_at' => now(),
            ]);
        });

        $response->refresh();

        return [
            'id' => $response->id,
            'work_survey_id' => $response->work_survey_id,
            'work_life_balance_score' => $response->work_life_balance_score,
            'workload_perception_score' => $response->workload_perception_score,
            'comments' => $response->comments,
            'submitted_at' => $response->submitted_at?->toIso8601String(),
        ];
    }

    /**
     * Load only the authenticated employee's own survey responses keyed by survey ID.
     *
     * @return array<int, array<string, mixed>>
     */
    private function loadOwnResponsesMap(UserAccount $actor): array
    {
        if ($actor->role !== 'employee' || ! $actor->employee) {
            return [];
        }

        return SurveyResponse::where('employee_id', $actor->employee->id)
            ->get()
            ->mapWithKeys(fn (SurveyResponse $resp) => [
                $resp->work_survey_id => [
                    'id' => $resp->id,
                    'work_survey_id' => $resp->work_survey_id,
                    'work_life_balance_score' => $resp->work_life_balance_score,
                    'workload_perception_score' => $resp->workload_perception_score,
                    'comments' => $resp->comments,
                    'submitted_at' => $resp->submitted_at?->toIso8601String(),
                ],
            ])
            ->all();
    }

    /**
     * Format survey with strictly aggregated department metrics (no individual leakage).
     *
     * @param  Collection<int, Department>  $departments
     * @param  array<int, array<string, mixed>>  $myResponsesBySurveyId
     * @return array<string, mixed>
     */
    private function formatSurvey(
        WorkSurvey $survey,
        UserAccount $actor,
        Collection $departments,
        int $activeEmployeesCount,
        array $myResponsesBySurveyId
    ): array {
        $overall = SurveyResponse::query()
            ->where('work_survey_id', $survey->id)
            ->selectRaw('COUNT(*) as total_count, AVG(work_life_balance_score) as avg_wlb, AVG(workload_perception_score) as avg_workload')
            ->first();

        $responsesCount = (int) ($overall->total_count ?? 0);
        $avgWlb = $responsesCount > 0 ? round((float) $overall->avg_wlb, 2) : null;
        $avgWorkload = $responsesCount > 0 ? round((float) $overall->avg_workload, 2) : null;
        $convertedWlbDim = $avgWlb !== null ? round((($avgWlb - 1) / 4) * 100, 2) : null;
        $participationRate = $activeEmployeesCount > 0
            ? round(($responsesCount / $activeEmployeesCount) * 100, 1)
            : 0.0;

        $deptStats = SurveyResponse::query()
            ->join('employees', 'survey_responses.employee_id', '=', 'employees.id')
            ->where('survey_responses.work_survey_id', $survey->id)
            ->groupBy('employees.department_id')
            ->selectRaw('employees.department_id, COUNT(*) as respondents_count, AVG(survey_responses.work_life_balance_score) as avg_wlb, AVG(survey_responses.workload_perception_score) as avg_workload')
            ->get()
            ->keyBy('department_id');

        $departmentAggregates = $departments->map(function (Department $dept) use ($deptStats) {
            $stat = $deptStats->get($dept->id);
            $respondentsCount = (int) ($stat->respondents_count ?? 0);
            $deptActiveCount = (int) ($dept->active_employees_count ?? 0);
            $deptAvgWlb = $respondentsCount > 0 ? round((float) $stat->avg_wlb, 2) : null;
            $deptAvgWorkload = $respondentsCount > 0 ? round((float) $stat->avg_workload, 2) : null;
            $deptConvertedWlb = $deptAvgWlb !== null ? round((($deptAvgWlb - 1) / 4) * 100, 2) : null;
            $deptParticipationRate = $deptActiveCount > 0
                ? round(($respondentsCount / $deptActiveCount) * 100, 1)
                : 0.0;

            return [
                'department_id' => $dept->id,
                'department_code' => $dept->code,
                'department_name' => $dept->name,
                'active_employees_count' => $deptActiveCount,
                'respondents_count' => $respondentsCount,
                'participation_rate' => $deptParticipationRate,
                'avg_wlb_score' => $deptAvgWlb,
                'avg_workload_perception_score' => $deptAvgWorkload,
                'converted_wlb_dimension_score' => $deptConvertedWlb,
            ];
        })->values()->all();

        $payload = [
            'id' => $survey->id,
            'title' => $survey->title,
            'period_month' => $survey->period_month,
            'description' => $survey->description,
            'is_active' => (bool) $survey->is_active,
            'responses_count' => $responsesCount,
            'avg_wlb_score' => $avgWlb,
            'avg_workload_perception_score' => $avgWorkload,
            'converted_wlb_dimension_score' => $convertedWlbDim,
            'participation_rate' => $participationRate,
            'department_aggregates' => $departmentAggregates,
            'created_at' => $survey->created_at?->toIso8601String(),
            'updated_at' => $survey->updated_at?->toIso8601String(),
        ];

        if ($actor->role === 'employee') {
            $payload['my_response'] = $myResponsesBySurveyId[$survey->id] ?? null;
        }

        return $payload;
    }
}
