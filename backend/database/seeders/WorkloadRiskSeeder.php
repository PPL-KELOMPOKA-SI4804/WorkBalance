<?php

namespace Database\Seeders;

use App\Models\UserAccount;
use App\Services\WorkloadRiskService;
use Illuminate\Database\Seeder;

class WorkloadRiskSeeder extends Seeder
{
    /**
     * Calculate and persist baseline Workload Risk records for all active employees on current week.
     */
    public function run(): void
    {
        $actor = UserAccount::whereIn('role', ['manager', 'admin'])->first();

        if (! $actor) {
            return;
        }

        app(WorkloadRiskService::class)->calculate([], $actor);
    }
}
