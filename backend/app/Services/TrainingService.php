<?php

namespace App\Services;

use App\Models\Training;
use App\Models\TrainingParticipation;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class TrainingService
{
    /**
     * Retrieve filtered training catalog programs alongside categories and summary metrics.
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function list(array $filters = []): array
    {
        $today = now()->toDateString();

        $query = Training::query()
            ->withCount($this->participationCounts());

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%")
                    ->orWhere('provider', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['category'])) {
            $query->where('category', trim((string) $filters['category']));
        }

        if (! empty($filters['schedule_status'])) {
            if ($filters['schedule_status'] === 'upcoming') {
                $query->whereDate('start_date', '>', $today);
            } elseif ($filters['schedule_status'] === 'ongoing') {
                $query->whereDate('start_date', '<=', $today)
                    ->whereDate('end_date', '>=', $today);
            } elseif ($filters['schedule_status'] === 'ended') {
                $query->whereDate('end_date', '<', $today);
            }
        }

        $trainings = $query
            ->orderByDesc('start_date')
            ->orderByDesc('id')
            ->get();

        $categories = Training::query()
            ->distinct()
            ->orderBy('category')
            ->pluck('category')
            ->values();

        return [
            'trainings' => $trainings,
            'categories' => $categories,
            'summary' => [
                'total' => Training::count(),
                'upcoming' => Training::whereDate('start_date', '>', $today)->count(),
                'ongoing' => Training::whereDate('start_date', '<=', $today)
                    ->whereDate('end_date', '>=', $today)
                    ->count(),
                'ended' => Training::whereDate('end_date', '<', $today)->count(),
                'total_duration_hours' => round((float) Training::sum('duration_hours'), 2),
                'total_participations' => TrainingParticipation::count(),
            ],
        ];
    }

    /**
     * Load complete details of a single training program including participations.
     */
    public function find(Training $training): Training
    {
        return $training
            ->load(['participations.employee.department', 'participations.employee.position'])
            ->loadCount($this->participationCounts());
    }

    /**
     * Create a new training program inside a database transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Training
    {
        return DB::transaction(function () use ($data) {
            $training = Training::create([
                'title' => trim((string) $data['title']),
                'category' => trim((string) $data['category']),
                'provider' => trim((string) $data['provider']),
                'duration_hours' => round((float) $data['duration_hours'], 2),
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
            ]);

            return $training->loadCount($this->participationCounts());
        });
    }

    /**
     * Update an existing training program inside a database transaction.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(Training $training, array $data): Training
    {
        $effectiveStartDate = array_key_exists('start_date', $data)
            ? Carbon::parse((string) $data['start_date'])->toDateString()
            : $training->start_date->toDateString();

        $effectiveEndDate = array_key_exists('end_date', $data)
            ? Carbon::parse((string) $data['end_date'])->toDateString()
            : $training->end_date->toDateString();

        if ($effectiveEndDate < $effectiveStartDate) {
            throw ValidationException::withMessages([
                'end_date' => ['Tanggal selesai tidak boleh lebih awal dari tanggal mulai.'],
            ]);
        }

        return DB::transaction(function () use ($training, $data) {
            $fields = [];

            if (array_key_exists('title', $data)) {
                $fields['title'] = trim((string) $data['title']);
            }

            if (array_key_exists('category', $data)) {
                $fields['category'] = trim((string) $data['category']);
            }

            if (array_key_exists('provider', $data)) {
                $fields['provider'] = trim((string) $data['provider']);
            }

            if (array_key_exists('duration_hours', $data)) {
                $fields['duration_hours'] = round((float) $data['duration_hours'], 2);
            }

            if (array_key_exists('start_date', $data)) {
                $fields['start_date'] = $data['start_date'];
            }

            if (array_key_exists('end_date', $data)) {
                $fields['end_date'] = $data['end_date'];
            }

            if ($fields !== []) {
                $training->update($fields);
            }

            return $training->fresh()->loadCount($this->participationCounts());
        });
    }

    /**
     * Delete a training program unless referenced by employee participations (restrictOnDelete).
     */
    public function delete(Training $training): void
    {
        if ($training->participations()->exists()) {
            throw new ConflictHttpException('Program pelatihan tidak dapat dihapus karena masih memiliki data keikutsertaan pegawai.');
        }

        DB::transaction(function () use ($training) {
            $training->delete();
        });
    }

    /**
     * Shared eager-count specification for training queries.
     *
     * @return array<int|string, mixed>
     */
    private function participationCounts(): array
    {
        return [
            'participations',
            'participations as completed_participations_count' => fn ($q) => $q->where('status', 'completed'),
            'participations as enrolled_participations_count' => fn ($q) => $q->where('status', 'enrolled'),
        ];
    }
}
